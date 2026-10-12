import Phaser from "phaser";
import { GAME_EVENTS } from "@/game/bridge/gameEvents";
import { BUSINESS_TYPES } from "@/game/data/businessTypes";
import { MAP_ORIGIN, MAP_SIZE, PLOTS, TILE_HEIGHT, TILE_WIDTH } from "@/game/data/mapData";
import type { Business, Plot } from "@/game/types";

const COLORS = {
  grass: 0x82bd72,
  grassLight: 0x9dce7a,
  grassDark: 0x6ba65e,
  road: 0x65716d,
  roadLine: 0xe5cc73,
  sidewalk: 0xd9ca9e,
  plot: 0xc9a879,
  plotLight: 0xe0c393,
  outline: 0x527f50,
};

type Point = { x: number; y: number };

export default class WorldScene extends Phaser.Scene {
  private readonly plotZones = new Map<string, Phaser.GameObjects.Zone>();
  private readonly plotHighlights = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly buildingViews = new Map<string, Phaser.GameObjects.Container>();
  private readonly pointerPositions = new Map<number, Point>();
  private selectedPlotId: string | null = null;
  private hoveredPlotId: string | null = null;
  private downPlotId: string | null = null;
  private downPoint: Point | null = null;
  private dragDistance = 0;
  private pinchDistance = 0;

  constructor() {
    super("WorldScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x9ed8c3);
    this.drawNeighborhood();
    this.createPlotInteractions();
    this.drawDecorations();
    this.bindEvents();
    this.resizeCamera(this.scale.gameSize);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    this.time.delayedCall(0, () => this.game.events.emit(GAME_EVENTS.worldReady));
  }

  private project(tileX: number, tileY: number): Point {
    return {
      x: MAP_ORIGIN.x + (tileX - tileY) * (TILE_WIDTH / 2),
      y: MAP_ORIGIN.y + (tileX + tileY) * (TILE_HEIGHT / 2),
    };
  }

  private diamondPoints(center: Point, inset = 0): Point[] {
    const halfWidth = TILE_WIDTH / 2 - inset;
    const halfHeight = TILE_HEIGHT / 2 - inset / 2;
    return [
      { x: center.x, y: center.y - halfHeight },
      { x: center.x + halfWidth, y: center.y },
      { x: center.x, y: center.y + halfHeight },
      { x: center.x - halfWidth, y: center.y },
    ];
  }

  private drawNeighborhood(): void {
    for (let tileY = 0; tileY < MAP_SIZE.rows; tileY += 1) {
      for (let tileX = 0; tileX < MAP_SIZE.columns; tileX += 1) {
        const center = this.project(tileX, tileY);
        const isRoad = tileY === 3 || tileX === 6;
        const isWalkway = !isRoad && (tileY === 2 || tileY === 4 || tileX === 5 || tileX === 7);
        const isPlot = PLOTS.some((plot) => plot.x === tileX && plot.y === tileY);
        const color = isRoad
          ? COLORS.road
          : isWalkway
            ? COLORS.sidewalk
            : isPlot
              ? COLORS.plot
              : (tileX + tileY) % 3 === 0
                ? COLORS.grassLight
                : COLORS.grass;
        const tile = this.add.graphics();
        tile.fillStyle(color, 1);
        tile.lineStyle(1, isRoad ? 0x59645f : COLORS.outline, 0.42);
        tile.fillPoints(this.diamondPoints(center), true);
        tile.strokePoints(this.diamondPoints(center), true);
        tile.setDepth((tileX + tileY) * 10);

        if (isRoad && tileY === 3 && tileX % 2 === 0) {
          const dash = this.add.graphics();
          dash.lineStyle(2, COLORS.roadLine, 0.9);
          dash.beginPath();
          dash.moveTo(center.x - 11, center.y);
          dash.lineTo(center.x + 11, center.y);
          dash.strokePath();
          dash.setDepth((tileX + tileY) * 10 + 1);
        }

        if (isPlot) this.drawPlotSurface(center, (tileX + tileY) * 10 + 2);
      }
    }
  }

  private drawPlotSurface(center: Point, depth: number): void {
    const surface = this.add.graphics();
    surface.fillStyle(COLORS.plotLight, 1);
    surface.lineStyle(2, 0x8d704a, 0.8);
    surface.fillPoints(this.diamondPoints(center, 7), true);
    surface.strokePoints(this.diamondPoints(center, 7), true);
    surface.fillStyle(0x9a815e, 0.32);
    surface.fillCircle(center.x - 11, center.y - 1, 2);
    surface.fillCircle(center.x + 9, center.y + 4, 2);
    surface.setDepth(depth);
  }

  private createPlotInteractions(): void {
    for (const plot of PLOTS) {
      const center = this.project(plot.x, plot.y);
      const zone = this.add
        .zone(center.x - TILE_WIDTH / 2, center.y - TILE_HEIGHT / 2, TILE_WIDTH, TILE_HEIGHT)
        .setOrigin(0)
        .setInteractive(
          new Phaser.Geom.Polygon([
            { x: TILE_WIDTH / 2, y: 1 },
            { x: TILE_WIDTH - 1, y: TILE_HEIGHT / 2 },
            { x: TILE_WIDTH / 2, y: TILE_HEIGHT - 1 },
            { x: 1, y: TILE_HEIGHT / 2 },
          ]),
          Phaser.Geom.Polygon.Contains,
        )
        .setDepth((plot.x + plot.y) * 10 + 9)
        .setData("plotId", plot.id);

      const highlight = this.add.graphics().setDepth((plot.x + plot.y) * 10 + 8);
      this.plotZones.set(plot.id, zone);
      this.plotHighlights.set(plot.id, highlight);
      zone.on("pointerover", () => {
        this.hoveredPlotId = plot.id;
        this.updateHighlights();
        this.game.canvas.style.cursor = "pointer";
      });
      zone.on("pointerout", () => {
        if (this.hoveredPlotId === plot.id) this.hoveredPlotId = null;
        this.updateHighlights();
        this.game.canvas.style.cursor = "grab";
      });
    }
  }

  private drawDecorations(): void {
    this.drawHouse(0, 1, 0xedae69);
    this.drawHouse(8, 1, 0x79a9a1);
    this.drawHouse(0, 6, 0xd97859);
    this.drawHouse(8, 6, 0xf0cc77);
    this.drawTree(1, 2);
    this.drawTree(8, 3);
    this.drawTree(2, 7);
    this.drawTree(7, 7);
    this.drawStreetlight(3, 2);
    this.drawStreetlight(7, 2);
    this.drawCar(4, 3);
  }

  private drawHouse(tileX: number, tileY: number, wallColor: number): void {
    const center = this.project(tileX, tileY);
    const depth = (tileX + tileY) * 10 + 5;
    const house = this.add.graphics();
    house.fillStyle(0x3f6555, 0.22);
    house.fillEllipse(center.x, center.y + 5, 62, 22);
    house.fillStyle(wallColor, 1);
    house.fillPoints([
      { x: center.x - 22, y: center.y - 28 },
      { x: center.x, y: center.y - 17 },
      { x: center.x, y: center.y + 8 },
      { x: center.x - 22, y: center.y - 2 },
    ], true);
    house.fillStyle(0xc78554, 1);
    house.fillPoints([
      { x: center.x, y: center.y - 17 },
      { x: center.x + 22, y: center.y - 28 },
      { x: center.x + 22, y: center.y - 3 },
      { x: center.x, y: center.y + 8 },
    ], true);
    house.fillStyle(0x8e5644, 1);
    house.fillPoints([
      { x: center.x - 25, y: center.y - 28 },
      { x: center.x, y: center.y - 42 },
      { x: center.x + 25, y: center.y - 29 },
      { x: center.x, y: center.y - 16 },
    ], true);
    house.fillStyle(0x6a4935, 1);
    house.fillRect(center.x - 5, center.y - 8, 10, 15);
    house.fillStyle(0xf5e2a2, 1);
    house.fillRect(center.x + 8, center.y - 8, 7, 7);
    house.setDepth(depth);
  }

  private drawTree(tileX: number, tileY: number): void {
    const center = this.project(tileX, tileY);
    const tree = this.add.graphics();
    tree.fillStyle(0x4e714c, 0.22);
    tree.fillEllipse(center.x, center.y + 8, 42, 17);
    tree.fillStyle(0x806044, 1);
    tree.fillRect(center.x - 3, center.y - 10, 7, 22);
    tree.fillStyle(0x45804f, 1);
    tree.fillCircle(center.x, center.y - 22, 18);
    tree.fillStyle(0x68a65b, 1);
    tree.fillCircle(center.x - 7, center.y - 27, 11);
    tree.fillCircle(center.x + 8, center.y - 26, 10);
    tree.setDepth((tileX + tileY) * 10 + 5);
  }

  private drawStreetlight(tileX: number, tileY: number): void {
    const center = this.project(tileX, tileY);
    const lamp = this.add.graphics();
    lamp.fillStyle(0x515e55, 1);
    lamp.fillRect(center.x - 2, center.y - 32, 4, 39);
    lamp.fillStyle(0xe6bd4d, 1);
    lamp.fillCircle(center.x, center.y - 35, 5);
    lamp.setDepth((tileX + tileY) * 10 + 6);
  }

  private drawCar(tileX: number, tileY: number): void {
    const center = this.project(tileX, tileY);
    const car = this.add.graphics();
    car.fillStyle(0x39494b, 0.3);
    car.fillEllipse(center.x, center.y + 9, 54, 16);
    car.fillStyle(0xe0a74d, 1);
    car.fillPoints([
      { x: center.x - 21, y: center.y - 1 },
      { x: center.x, y: center.y - 12 },
      { x: center.x + 21, y: center.y - 1 },
      { x: center.x + 18, y: center.y + 9 },
      { x: center.x - 18, y: center.y + 9 },
    ], true);
    car.fillStyle(0x496c70, 1);
    car.fillPoints([
      { x: center.x - 10, y: center.y - 3 },
      { x: center.x, y: center.y - 9 },
      { x: center.x + 10, y: center.y - 3 },
    ], true);
    car.fillStyle(0x28393b, 1);
    car.fillCircle(center.x - 13, center.y + 8, 4);
    car.fillCircle(center.x + 13, center.y + 8, 4);
    car.setDepth((tileX + tileY) * 10 + 6);
  }

  private bindEvents(): void {
    this.game.events.on(GAME_EVENTS.businessesChanged, this.renderBusinesses, this);
    this.game.events.on(GAME_EVENTS.plotSelectionChanged, this.selectPlot, this);
    this.game.events.on(GAME_EVENTS.cameraReset, this.resetCamera, this);
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);
    this.input.on("pointerupoutside", this.onPointerUp, this);
    this.input.on("wheel", this.onWheel, this);
  }

  private renderBusinesses(businesses: Business[]): void {
    for (const view of this.buildingViews.values()) view.destroy(true);
    this.buildingViews.clear();
    for (const business of businesses) {
      const plot = PLOTS.find((candidate) => candidate.id === business.plotId);
      if (!plot) continue;
      this.buildingViews.set(business.id, this.drawBusiness(plot, business));
    }
  }

  private drawBusiness(plot: Plot, business: Business): Phaser.GameObjects.Container {
    const center = this.project(plot.x, plot.y);
    const definition = BUSINESS_TYPES[business.type];
    const art = this.add.graphics();
    const container = this.add.container(center.x, center.y - 6, [art]);
    container.setDepth((plot.x + plot.y) * 10 + 7);
    art.fillStyle(0x554734, 0.2);
    art.fillEllipse(0, 19, 48, 18);
    art.fillStyle(0x856142, 1);
    art.fillPoints([{ x: -20, y: -5 }, { x: 0, y: 5 }, { x: 0, y: 27 }, { x: -20, y: 16 }], true);
    art.fillStyle(0x6f5038, 1);
    art.fillPoints([{ x: 0, y: 5 }, { x: 20, y: -5 }, { x: 20, y: 16 }, { x: 0, y: 27 }], true);
    art.fillStyle(definition.color, 1);
    art.fillPoints([{ x: -23, y: -6 }, { x: 0, y: -18 }, { x: 23, y: -6 }, { x: 0, y: 6 }], true);
    art.lineStyle(2, 0x624632, 1);
    art.strokePoints([{ x: -23, y: -6 }, { x: 0, y: -18 }, { x: 23, y: -6 }, { x: 0, y: 6 }], true);
    art.fillStyle(0xfff0c5, 1);
    art.fillRect(-12, 1, 8, 7);
    art.fillRect(5, 0, 7, 7);
    art.fillStyle(0x6e5036, 1);
    art.fillRect(-3, 12, 7, 14);

    const sign = this.add.text(0, -9, definition.shortName, {
      color: "#263a31",
      fontFamily: "Arial, sans-serif",
      fontSize: "8px",
      fontStyle: "bold",
      backgroundColor: "#fff1bd",
      padding: { x: 3, y: 2 },
    }).setOrigin(0.5, 0.5);
    container.add(sign);
    return container;
  }

  private selectPlot(plotId: string | null): void {
    this.selectedPlotId = plotId;
    this.updateHighlights();
  }

  private updateHighlights(): void {
    for (const plot of PLOTS) {
      const graphics = this.plotHighlights.get(plot.id);
      if (!graphics) continue;
      graphics.clear();
      if (this.selectedPlotId !== plot.id && this.hoveredPlotId !== plot.id) continue;
      const center = this.project(plot.x, plot.y);
      graphics.fillStyle(this.selectedPlotId === plot.id ? 0xf4c44e : 0xf8e5a6, 0.35);
      graphics.lineStyle(this.selectedPlotId === plot.id ? 3 : 2, 0xffd452, 1);
      graphics.fillPoints(this.diamondPoints(center, 5), true);
      graphics.strokePoints(this.diamondPoints(center, 5), true);
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]): void {
    const target = currentlyOver.find((gameObject) => typeof gameObject.getData("plotId") === "string");
    this.downPlotId = target?.getData("plotId") as string | undefined ?? null;
    this.downPoint = { x: pointer.x, y: pointer.y };
    this.dragDistance = 0;
    this.pointerPositions.set(pointer.id, { x: pointer.x, y: pointer.y });
    this.pinchDistance = 0;
    this.game.canvas.style.cursor = "grabbing";
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown) return;
    const active = this.input.manager.pointers.filter((candidate) => candidate.isDown);
    if (active.length >= 2) {
      const [first, second] = active;
      const distance = Phaser.Math.Distance.Between(first.x, first.y, second.x, second.y);
      if (this.pinchDistance > 0) this.setZoom(this.cameras.main.zoom * (distance / this.pinchDistance));
      this.pinchDistance = distance;
      this.pointerPositions.set(first.id, { x: first.x, y: first.y });
      this.pointerPositions.set(second.id, { x: second.x, y: second.y });
      this.dragDistance = 20;
      return;
    }

    const previous = this.pointerPositions.get(pointer.id);
    if (!previous) return;
    const deltaX = pointer.x - previous.x;
    const deltaY = pointer.y - previous.y;
    this.dragDistance += Math.hypot(deltaX, deltaY);
    this.pointerPositions.set(pointer.id, { x: pointer.x, y: pointer.y });
    this.cameras.main.scrollX -= deltaX / this.cameras.main.zoom;
    this.cameras.main.scrollY -= deltaY / this.cameras.main.zoom;
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.downPoint && this.dragDistance < 9 && this.downPlotId) {
      this.game.events.emit(GAME_EVENTS.plotSelected, this.downPlotId);
    }
    this.pointerPositions.delete(pointer.id);
    this.downPoint = null;
    this.downPlotId = null;
    this.pinchDistance = 0;
    this.game.canvas.style.cursor = "grab";
  }

  private onWheel(
    pointer: Phaser.Input.Pointer,
    _currentlyOver: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    this.setZoom(this.cameras.main.zoom * Math.exp(-deltaY * 0.001));
    this.cameras.main.centerOn(pointer.worldX, pointer.worldY);
  }

  private setZoom(zoom: number): void {
    this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.48, 1.35));
  }

  private resizeCamera(size: Phaser.Structs.Size): void {
    const fit = Math.min(size.width / 850, size.height / 520, 1.15);
    this.cameras.main.setZoom(Phaser.Math.Clamp(fit, 0.48, 1.15));
    this.cameras.main.setBounds(170, 0, 660, 540);
    this.cameras.main.centerOn(MAP_ORIGIN.x, 290);
  }

  private resetCamera(): void {
    this.resizeCamera(this.scale.gameSize);
  }

  private teardown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeCamera, this);
    this.game.events.off(GAME_EVENTS.businessesChanged, this.renderBusinesses, this);
    this.game.events.off(GAME_EVENTS.plotSelectionChanged, this.selectPlot, this);
    this.game.events.off(GAME_EVENTS.cameraReset, this.resetCamera, this);
    this.input.off("pointerdown", this.onPointerDown, this);
    this.input.off("pointermove", this.onPointerMove, this);
    this.input.off("pointerup", this.onPointerUp, this);
    this.input.off("pointerupoutside", this.onPointerUp, this);
    this.input.off("wheel", this.onWheel, this);
    this.plotZones.clear();
    this.plotHighlights.clear();
    this.buildingViews.clear();
  }
}