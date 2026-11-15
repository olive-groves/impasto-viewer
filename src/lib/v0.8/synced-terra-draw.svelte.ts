import { SvelteMap } from 'svelte/reactivity';

import type { MapLibreMap } from 'maplibre-gl';
import type {
  TerraDraw,
  TerraDrawEventListeners,
  GeoJSONStoreFeatures,
  GeoJSONStoreGeometries,
} from 'terra-draw';
import type { Polygon } from 'geojson';

import { roundGeometryCoordinates } from '$lib/v0.8/maplibre-gl-terradraw/lib/helpers/roundFeatureCoordinates';
import { terraDrawMaxBounds, wrapGeometryCoordinatesToBounds } from '$lib/v0.8/geojson-utils';
import type { FeatureId } from '$lib/v0.8/geojson-utils';
import { ISOLATED_EDIT_MODE_NAME } from '$lib/v0.8/synced-terra-draw-mode-factory.svelte';
import type { Mode, ModeFactory } from '$lib/v0.8/synced-terra-draw-mode-factory.svelte';


// One of the modes in the ModeFactory passed to SyncedTerraDraw must be named "edit".
// That edit mode is used to generate the isolated-edit mode that this manager triggers
// when drawing has finished.
// We don't set the mode on SyncedTerraDraw, we set it via the manager. It tells us the
// the user-facing mode while keeping the actual mode.
export class SyncedTerraDrawModeManager {
  syncedTerraDraw: SyncedTerraDraw;

  private _userMode: string = $state("");
  readonly userMode: string = $derived(this._userMode);

  private _actualMode: string = $state("");
  readonly actualMode: string = $derived(this._actualMode);

  private isolatedEditOnFinish: boolean;
  private isolatedEditId: FeatureId | null = $state(null);
  private lastUserMode: string | null = $state(null);

  static LAST_MODE = Symbol("last");
  modeOnDeselect: typeof SyncedTerraDrawModeManager.LAST_MODE | Mode["mode"] = SyncedTerraDrawModeManager.LAST_MODE;

  constructor(
    syncedTerraDraw: SyncedTerraDraw,
    { initialUserMode = undefined, isolatedEditOnFinish = true, modeOnDeselect = undefined }: { initialUserMode?: Mode["mode"], isolatedEditOnFinish?: boolean, modeOnDeselect?: Mode["mode"] } = {}
  ) {
    this.syncedTerraDraw = syncedTerraDraw;
    this.isolatedEditOnFinish = isolatedEditOnFinish;

    $effect.root(() => {
      this.syncedTerraDraw.mode = this.actualMode;
    });

    // Auto-select listeners
    this.syncedTerraDraw.onSyncedDeselectListeners.push((_, featureId) => {
      if (featureId === this.isolatedEditId && this._actualMode === ISOLATED_EDIT_MODE_NAME) {
        this.deselectIsolatedEdit();
      }
    });
    this.syncedTerraDraw.onSyncedFinishListeners.push((_, featureId, context) => {
      if (context?.action === 'draw' && this.isolatedEditOnFinish) {
        this.selectIsolatedEdit(featureId);
      }
    });

    this.setUserMode(initialUserMode ?? this.syncedTerraDraw.modeFactory().filter((mode) => mode.type === "select").find((mode) => mode.mode.includes("select"))?.mode ?? "");

    if (modeOnDeselect)
      this.modeOnDeselect = modeOnDeselect;
  }

  // Select a feature with isolated edit mode, allowing edits only on that feature;
  // if clicked away, exits isolated edit mode and returns to the previous mode.
  // If null, deselects.
  selectIsolatedEdit(featureId: FeatureId): void {
    if (featureId === this.isolatedEditId && featureId === this.syncedTerraDraw.selected)
      return;
    // If the feature being selected for isolated edit is already selected in a
    // different mode, then when we deselect it first. Otherwise, by selecting it for
    // isolated edit, it gets deselected from its original mode, and the ondeselect
    // callback calls deselect here, blowing away our logic.
    if (this.syncedTerraDraw.selected === featureId) {
      this.syncedTerraDraw.syncedDeselectFeature(undefined, featureId);
    }

    this.isolatedEditId = featureId;
    this.lastUserMode = this.userMode;
    this._actualMode = ISOLATED_EDIT_MODE_NAME;
    setTimeout(() => {
      this.syncedTerraDraw.syncedSelectFeature(undefined, featureId, ISOLATED_EDIT_MODE_NAME);
    });
    return
  }

  deselectIsolatedEdit(userMode?: Mode["mode"], keepSelected: boolean = false): void {
    const id = this.isolatedEditId;
    if (id !== null) {
      this.syncedTerraDraw.syncedDeselectFeature(undefined, id);
      this.isolatedEditId = null;
    };
    const _mode = userMode ?? this.modeOnDeselect;
    if (_mode === SyncedTerraDrawModeManager.LAST_MODE) {
      if (this.lastUserMode !== null) {
        this._actualMode = this.lastUserMode;
      }
    } else {
      this.setUserMode(_mode.toString());
    }
    if (keepSelected && (id !== null))
      this.syncedTerraDraw.syncedSelectFeature(undefined, id);
    return
  }

  setUserMode(mode: Mode["mode"]): void {
    // If userMode is set, set the actualMode
    this._userMode = mode;
    this._actualMode = mode;
    // TODO: Determine whether this was ultimately necessary to deselect selected.
    // const currentlySelected = this.syncedTerraDraw.selected;
    // if (currentlySelected !== null) {
    //   this.syncedTerraDraw.syncedDeselectFeature(undefined, currentlySelected);
    // }
    return
  }

}

export class SyncedTerraDraw {
  mode: string = $state("");
  modeFactory: ModeFactory;
  readonly modeNames: Mode["mode"][];

  private _selected: FeatureId | null = $state(null);
  readonly selected: FeatureId | null = $derived(this._selected);
  editing: string | number | null = $state(null);

  onreadyListeners: TerraDrawEventListeners["ready"][] = [];
  onfinishListeners: TerraDrawEventListeners["finish"][] = [];
  onchangeListeners: TerraDrawEventListeners["change"][] = [];
  onselectListeners: TerraDrawEventListeners["select"][] = [];
  ondeselectListeners: TerraDrawEventListeners["deselect"][] = [];
  onhistoryListeners: TerraDrawEventListeners["history"][] = [];

  onSyncedAddFeaturesListeners: ((features: GeoJSONStoreFeatures[]) => void)[] = [];
  onSyncedUpdateFeatureGeometryListeners: ((id: FeatureId, geometry: GeoJSONStoreGeometries) => void)[] = [];
  onSyncedDeselectListeners: ((instanceId: string | undefined, id: FeatureId) => void)[] = [];
  onSyncedFinishListeners: ((instanceId: string | undefined, id: FeatureId, context: Parameters<TerraDrawEventListeners["finish"]>[1]) => void)[] = [];

  // FIXME: Determine whether to retain actual draw or create a mock (snapshot, etc.);
  // will affect and be affected by the undo/redo implementation
  // TODO: Undo-redo necessary for drawing, but maybe not generally?
  readonly id: string = "terra-draw-synced-parent-map";
  map: MapLibreMap | undefined = $state.raw();
  draw: TerraDraw | undefined = $state.raw();

  // TODO: Determine whether keeping state on a potentially massive array is the move...
  snapshot: GeoJSONStoreFeatures<GeoJSONStoreGeometries>[] = $state([]);
  // add a setter for properties?

  instances = new SvelteMap<string, TerraDrawInstance>();

  constructor(modeFactory: ModeFactory, mode?: string) {
    $effect.root(() => {
      this.draw?.setMode(this.mode);
    });
    if (mode)
      this.mode = mode;
    this.modeFactory = modeFactory;
    this.modeNames = modeFactory().map((mode) => mode.mode);
  }

  syncedSelectFeature(sourceInstanceId: string | undefined, featureId: FeatureId, selectMode?: string): ReturnType<TerraDraw["selectFeature"]> {
    const _featureId = featureId ?? null;
    if (this.selected === _featureId && this.mode === selectMode)
      return;
    this._selected = _featureId;
    this.draw?.selectFeature(_featureId, selectMode);
    // FIXME: Avoid race condition a better way? Or a don't-propagate-select mode?
    this.instances.forEach((_instance, _instanceId) => {
      setTimeout(() => {
        if (_instanceId === sourceInstanceId)
          return;
        _instance.selectFeature(_featureId, selectMode);
      })
    })
  }

  syncedDeselectFeature(sourceInstanceId: string | undefined, featureId: FeatureId | null): ReturnType<TerraDraw["deselectFeature"]> {
    if (this.selected === null) {
      console.warn("Skipping synced deselect because nothing is currently selected.")
      return;
    }
    const toBeDeselected = featureId === null ? this.selected : featureId;
    if (toBeDeselected !== this.selected) {
      console.warn(`Skipping synced deselect because feature ${toBeDeselected} is not currently selected — ${this.selected === null ? "nothing is" : `feature ${this.selected} is`}. Pass 'null' to deselect the currently selected feature regardless.`);
      return;
    }
    this._selected = null;
    this.draw?.deselectFeature(toBeDeselected);
    this.instances.forEach((_instance, _instanceId) => {
      if (_instanceId === sourceInstanceId)
        return;
      _instance.deselectFeature(toBeDeselected);
    });
    this.onSyncedDeselect(sourceInstanceId, toBeDeselected);
    return
  }

  // Add features to the synced parent, snapshot state store, and propogate them to the
  // instances besides the optional source instance.
  syncedAddFeatures(sourceInstanceId?: string, ...args: Parameters<TerraDraw["addFeatures"]>): ReturnType<TerraDraw["addFeatures"]> {
    this.instances.forEach((instance, instanceId) => {
      if (instanceId === sourceInstanceId)
        return;
      instance.addFeatures(...args);
    });
    this.snapshot.push(...args[0]);
    const validation = this.draw?.addFeatures(...args) ?? []
    this.onSyncedAddFeatures(...args);
    return validation;
  }

  syncedUpdateFeatureGeometry(sourceInstanceId?: string, ...args: Parameters<TerraDraw["updateFeatureGeometry"]>): ReturnType<TerraDraw["updateFeatureGeometry"]> {
    this.draw?.updateFeatureGeometry(...args);
    this.instances.forEach((instance, instanceId) => {
      if (instanceId === sourceInstanceId)
        return;
      instance.updateFeatureGeometry(...args);
    })
    const feature = this.snapshot.find((feature) => feature.id === args[0]);
    if (feature) {
      feature.geometry = args[1];
    }
    this.onSyncedUpdateFeatureGeometry(...args);
    return
  }

  syncedRemoveFeatures(sourceInstanceId?: string, ...args: Parameters<TerraDraw["removeFeatures"]>): ReturnType<TerraDraw["removeFeatures"]> {
    this.instances.forEach((instance, instanceId) => {
      if (instanceId === sourceInstanceId)
        return;
      instance.removeFeatures(...args);
    });

    // Find the index of each feature
    // Sort the indices in decreasing order
    // Remove by splicing
    const featureIndices: number[] = [];
    args[0].forEach((featureId) => {
      featureIndices.push(this.snapshot.findIndex((feature) => feature.id === featureId))
    });
    featureIndices.sort((a, b) => b - a).forEach((i) => this.snapshot.splice(i, 1));

    // if (featureIndices.length)
    // TODO: this.onSyncedDeleteFeatures(...args);

    return this.draw?.removeFeatures(...args);
  }

  /**
   * Doesn't update snapshot state; only updates draw instance properties.
   * Use this only if you need a specific TerraDraw behavior, like conditional styling.
   */
  syncedUpdateFeatureProperties(sourceInstanceId?: string, ...args: Parameters<TerraDraw["updateFeatureProperties"]>): ReturnType<TerraDraw["updateFeatureProperties"]> {
    this.instances.forEach((instance, instanceId) => {
      if (instanceId === sourceInstanceId)
        return;
      instance.updateFeatureProperties(...args);
    });
    return
  }

  /**
   * Only updates parent snapshot state; draw instances are kept TerraDraw-relevant.
   * Use `syncedUpdatedFeatureProperties` for draw instances.
   * This abides by JSON: undefined values remove their keys!
   * TODO: Add internal property setter to support modified date-time?
   */
  updateSnapshotFeatureProperties(...args: Parameters<TerraDraw["updateFeatureProperties"]>): ReturnType<TerraDraw["updateFeatureProperties"]> {
    const feature = this.snapshot.find((f) => f.id === args[0]);
    if (feature)
      Object.entries(args[1]).map(([key, value]) => {
        if (value === undefined) {
          delete feature.properties[key];
        } else {
          feature.properties[key] = value;
        }
      });
    return
  }

  addInstance(customId?: string): TerraDrawInstance {
    const id = customId ?? crypto.randomUUID();
    let instance = new TerraDrawInstance(id, this.modeFactory);
    instance.onreadyListeners.push((...args) => this.synconready(instance.id, args));
    instance.onselectListeners.push((...args) => this.synconselect(instance.id, args));
    instance.ondeselectListeners.push((...args) => this.syncondeselect(instance.id, args));
    instance.onfinishListeners.push((...args) => this.synconfinish(instance.id, args));
    instance.onchangeListeners.push((...args) => this.synconchange(instance.id, args));
    // FIXME: Set timeout, await, or some other trigger for setting snapshot?
    // 'ready' doesn't fire on first component instantiation; only after explicit stop-start (hide-show)
    // instance.onreadyListeners.push(() => instance.draw?.addFeatures(this.draw?.getSnapshot() ?? []));
    // setTimeout(() => {
    //   if (this.draw === undefined)
    //     console.warn("No synced TerraDraw parent from which to get a snapshot. Perhaps you forgot to instantiate the parent draw and map with <SyncedTerraDrawComponent>?");
    //   instance.addFeatures(this.draw?.getSnapshot() ?? []);
    // }, 200)
    if (this.draw === undefined) {
      console.warn("No synced TerraDraw parent from which to get a snapshot. Perhaps you forgot to instantiate the parent draw and map with <SyncedTerraDrawComponent>?")
    } else {
      // FIXME: We want don't want custom properties in our parent snapshot to leak into
      // the instance snapshots. Do we filter out non-TerraDraw props?
      instance.addFeatures(this.draw?.getSnapshot().filter((f) => !f.properties.midPoint && !f.properties.selectionPoint) ?? []);
    };
    this.instances.set(id, instance);
    const selected = this.selected;
    if (selected) {
      // FIXME: Await draw instantiation rather than timeout?
      setTimeout(() => {
        instance.selectFeature(selected);
      }, 200)
    }
    return instance
  }

  synconready = (instanceId: string, args: Parameters<TerraDrawEventListeners["ready"]>) => {
    // console.log("synconready", ...args);
  }

  synconselect = (instanceId: string, args: Parameters<TerraDrawEventListeners["select"]>) => {
    // console.log("synconselect", ...args);
    const featureId = args[0];
    if (this.selected !== featureId)
      this.syncedSelectFeature(instanceId, featureId);
  }
  syncondeselect = (instanceId: string, args: Parameters<TerraDrawEventListeners["deselect"]>) => {
    // console.log("syncondeselect", ...args);

    const featureId = args[0];

    // Sync
    this.syncedDeselectFeature(instanceId, featureId);

    // FIXME: This spams synced feature geometry listeners despite no synced update.
    // It should only return the draw instance's geometry.
    // This fixes a bug when pressing Escape (cancelling) when dragging a selected feature; onfinish returns undefined id; catch on deselect
    const instance = this.instances.get(instanceId);
    let feature = instance?.getSnapshotFeature(featureId);
    if (feature) {
      this.syncedUpdateFeatureGeometry(instanceId, featureId, feature.geometry);
    }
  }

  synconfinish = (instanceId: string, args: Parameters<TerraDrawEventListeners["finish"]>) => {
    // console.log("synconfinish", ...args);
    const instance = this.instances.get(instanceId);
    const featureId = args[0];
    const context = args[1];
    if (!instance || typeof featureId === "undefined")
      return;
    if (context?.action === "draw") {
      const feature = instance.getSnapshotFeature(featureId);
      if (feature) {
        this.syncedAddFeatures(instanceId, [feature]);
      }
    // } else if (context && ["dragCoordinate", "dragFeature", "dragCoordinateResize",].includes(context?.action)) {
    } else {
      const feature = instance.getSnapshotFeature(featureId);
      if (feature) {
        feature.geometry.coordinates = wrapGeometryCoordinatesToBounds(feature.geometry, terraDrawMaxBounds);
        feature.geometry = roundGeometryCoordinates(feature.geometry);

        // Fixes: Polyline in-edit linestrings have geometry.type === 'LineString', but
        // have geometry coordinates of 'Polygon', so we adjust for that.
        if (feature.geometry.type === "LineString" && Array.isArray(feature.geometry.coordinates.at(0)?.at(0)))
          feature.geometry.coordinates = (feature.geometry as unknown as Polygon).coordinates[0];

        instance.updateFeatureGeometry(featureId, feature.geometry);  // Ensure drawn is wrapped
        this.syncedUpdateFeatureGeometry(instanceId, featureId, feature.geometry);
      }
    }

    this.onSyncedFinish(instanceId, featureId, context);
  }

  synconchange = (instanceId: string, args: Parameters<TerraDrawEventListeners["change"]>) => {
    const type = args[1];

    // Prevent recursive delete events by not syncing if features were removed with API.
    // TODO: That feels a bit sussy. We must ensure that instance.draw.removeFeatures()
    // can't be directly called, otherwise this breaks.
    const context = args[2];
    if (type === "delete" && (context as { origin?: "api" })?.origin !== "api") {
      // Midpoint and selection point removal also fires onchange-delete, so we
      // only synchronously remove features, not midpoints nor selection points.
      // Grab from synced snapshot because if it's not there, it's not anywhere.
      const filteredFeatureIds = args[0].filter((id) => {
        const feature = this.snapshot.find((f) => f.id === id);
        return feature && !feature?.properties.midPoint && !feature?.properties.selectionPoint;
      });

      this.syncedRemoveFeatures(instanceId, filteredFeatureIds);
    }
  }

  readonly onready: TerraDrawEventListeners["ready"] = (...args) => this.onreadyListeners.forEach((listener) => listener(...args));
  readonly onfinish: TerraDrawEventListeners["finish"] = (...args) => this.onfinishListeners.forEach((listener) => listener(...args));
  readonly onchange: TerraDrawEventListeners["change"] = (...args) => this.onchangeListeners.forEach((listener) => listener(...args));
  readonly onselect: TerraDrawEventListeners["select"] = (...args) => this.onselectListeners.forEach((listener) => listener(...args));
  readonly ondeselect: TerraDrawEventListeners["deselect"] = (...args) => this.ondeselectListeners.forEach((listener) => listener(...args));
  readonly onhistory: TerraDrawEventListeners["history"] = (...args) => this.onhistoryListeners.forEach((listener) => listener(...args));

  readonly onSyncedAddFeatures = (features: GeoJSONStoreFeatures[]) => this.onSyncedAddFeaturesListeners.forEach((listener) => listener(features));
  readonly onSyncedUpdateFeatureGeometry = (id: FeatureId, geometry: GeoJSONStoreGeometries) => this.onSyncedUpdateFeatureGeometryListeners.forEach((listener) => listener(id, geometry));
  readonly onSyncedDeselect = (instanceId: string | undefined, id: FeatureId) => this.onSyncedDeselectListeners.forEach((listener) => listener(instanceId, id));
  readonly onSyncedFinish = (instanceId: string | undefined, id: FeatureId, context: Parameters<TerraDrawEventListeners["finish"]>[1]) => this.onSyncedFinishListeners.forEach((listener) => listener(instanceId, id, context));
}

export class TerraDrawInstance {
  id: string;
  draw: TerraDraw | undefined = $state.raw();
  modeFactory: ModeFactory;
  private snapshot: ReturnType<TerraDraw["getSnapshot"]> = [];
  private _visible: boolean = $state(true);
  readonly visible = $derived(this._visible);
  private selected: FeatureId | null = null;

  onreadyListeners: TerraDrawEventListeners["ready"][] = [];
  onfinishListeners: TerraDrawEventListeners["finish"][] = [];
  onchangeListeners: TerraDrawEventListeners["change"][] = [];
  onselectListeners: TerraDrawEventListeners["select"][] = [];
  ondeselectListeners: TerraDrawEventListeners["deselect"][] = [];
  onhistoryListeners: TerraDrawEventListeners["history"][] = [];
  onstartListeners: ((draw: TerraDraw) => void)[] = [];
  onbeforestopListeners: ((draw: TerraDraw) => void)[] = [];

  constructor(id: string, modeFactory: ModeFactory) {
    this.id = id;
    this.modeFactory = modeFactory;
    this.onstartListeners.push((draw) => draw.addFeatures(this.snapshot));
    this.onbeforestopListeners.push((draw) => this.snapshot = draw.getSnapshot() ?? []);
    this.onselectListeners.push((featureId) => this.selected = featureId);
    this.ondeselectListeners.push(() => this.selected = null);
  }

  readonly onready: TerraDrawEventListeners["ready"] = (...args) => this.onreadyListeners.forEach((listener) => listener(...args));
  readonly onfinish: TerraDrawEventListeners["finish"] = (...args) => this.onfinishListeners.forEach((listener) => listener(...args));
  readonly onchange: TerraDrawEventListeners["change"] = (...args) => this.onchangeListeners.forEach((listener) => listener(...args));
  readonly onselect: TerraDrawEventListeners["select"] = (...args) => this.onselectListeners.forEach((listener) => listener(...args));
  readonly ondeselect: TerraDrawEventListeners["deselect"] = (...args) => this.ondeselectListeners.forEach((listener) => listener(...args));
  readonly onhistory: TerraDrawEventListeners["history"] = (...args) => this.onhistoryListeners.forEach((listener) => listener(...args));
  readonly onstart: (draw: TerraDraw) => void = (...args) => this.onstartListeners.forEach((listener) => listener(...args));
  readonly onbeforestop: (draw: TerraDraw) => void = (...args) => this.onbeforestopListeners.forEach((listener) => listener(...args));

  addFeatures = (...args: Parameters<TerraDraw["addFeatures"]>): ReturnType<TerraDraw["addFeatures"]> | "not-validated" => {
    if (this.draw?.enabled) {
      return this.draw.addFeatures(...args);
    } else {
      // Validation of pushed features occurs when (re)enabled... kinda kicking the can down the road.
      this.snapshot.push(...args[0])
      return "not-validated"
    }
  }

  updateFeatureGeometry(...args: Parameters<TerraDraw["updateFeatureGeometry"]>): ReturnType<TerraDraw["updateFeatureGeometry"]> {
    if (this.draw?.enabled) {
      return this.draw.updateFeatureGeometry(...args);
    }

    const featureIndex = this.snapshot.findIndex((feature) => feature.id === args[0]);
    if (featureIndex < 0)
      return

    this.snapshot[featureIndex] = { ...this.snapshot.at(featureIndex) as GeoJSONStoreFeatures, geometry: args[1] }
    return
  }

  updateFeatureProperties(...args: Parameters<TerraDraw["updateFeatureProperties"]>): ReturnType<TerraDraw["updateFeatureProperties"]> {
    if (this.draw?.enabled) {
      return this.draw.updateFeatureProperties(...args);
    }

    const featureIndex = this.snapshot.findIndex((feature) => feature.id === args[0]);
    if (featureIndex < 0)
      return

    Object.entries(args[1]).map(([key, value]) => {
      if (value === undefined) {
        delete this.snapshot[featureIndex].properties[key];
      } else {
        this.snapshot[featureIndex].properties[key] = value;
      }
    });
    return
  }

  removeFeatures(...args: Parameters<TerraDraw["removeFeatures"]>): ReturnType<TerraDraw["removeFeatures"]> {
    if (this.draw?.enabled) {
      return this.draw.removeFeatures(...args);
    }

    // Find the index of each feature
    // Sort the indices in decreasing order
    // Remove by splicing
    const featureIndices: number[] = [];
    args[0].forEach((featureId) => {
      featureIndices.push(this.snapshot.findIndex((feature) => feature.id === featureId))
    });
    featureIndices.sort((a, b) => b - a).forEach((i) => this.snapshot.splice(i, 1));

    return
  }

  getSnapshotFeature(...args: Parameters<TerraDraw["getSnapshotFeature"]>): ReturnType<TerraDraw["getSnapshotFeature"]> {
    if (this.draw?.enabled) {
      return this.draw.getSnapshotFeature(...args);
    }
    return this.snapshot.find((feature) => feature.id === args[0]);
  }

  selectFeature(...args: Parameters<TerraDraw["selectFeature"]>): ReturnType<TerraDraw["selectFeature"]> {
    // Guard against recursive onselect events when already selected.
    if (this.selected !== args[0]) {
      if (this.draw?.enabled)
        return this.draw.selectFeature(...args);
      return
    }
    console.debug(`selectFeature skipped because feature ${args[0]} is already selected.`)
    return
  }

  deselectFeature(...args: Parameters<TerraDraw["deselectFeature"]>): ReturnType<TerraDraw["deselectFeature"]> {
    // Guard against recursive ondeselect events when already null.
    if (this.selected !== null) {
      if (this.draw?.enabled)
        return this.draw.deselectFeature(...args)
      return
    }

    console.debug(`deselectFeature skipped because there is already nothing selected.`)
    return
  }
}
