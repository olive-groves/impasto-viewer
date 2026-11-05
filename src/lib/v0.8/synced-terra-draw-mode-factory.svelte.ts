import {
  TerraDrawSelectMode,
  TerraDrawMarkerMode,
  TerraDrawPolyLineMode,
  TerraDrawRectangleMode,
  TerraDrawFreehandLineStringMode,
  ValidateNotSelfIntersecting,
} from 'terra-draw';
import type {
  GeoJSONStoreFeatures,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawRenderMode,
} from 'terra-draw';

import { isGeometryOutOfBounds, terraDrawMaxBounds } from '$lib/v0.8/geojson-utils';


export type Mode =
  | TerraDrawSelectMode
  | TerraDrawPointMode
  | TerraDrawPolygonMode
  | TerraDrawPolyLineMode
  | TerraDrawMarkerMode
  | TerraDrawRectangleMode
  | TerraDrawFreehandLineStringMode
  | TerraDrawRenderMode;
export type ModeFactory = () => Mode[];


export const ISOLATED_EDIT_MODE_NAME: string = "isolated-edit";

export type Validator = (feature: GeoJSONStoreFeatures, { updateType }: { updateType: "finish" | "commit" | "provisional" }) => { valid: boolean }

const outOfBoundsValidator: Validator = (feature, { updateType }) => {
  return { valid: !isGeometryOutOfBounds(feature.geometry, terraDrawMaxBounds) }
}

// Shared state, options
const defaultPointerDistance = 25;
const defaultKeyEvents = {
  delete: null,
  rotate: null,
  scale: null,
  deselect: "Escape",
}
const defaultSelectFlags = {
  feature: {
    draggable: false,
    coordinates: {
      deletable: false,
      midpoints: false,
      draggable: false,
    }
  }
};
const selectFlags = {
  marker: defaultSelectFlags,
  polyline: defaultSelectFlags,
  rectangle: defaultSelectFlags,
  "freehand-linestring": defaultSelectFlags,
}
const editFlags = {
  marker: {
    feature: {
      draggable: true,
    }
  },
  polyline: {
    feature: {
      draggable: true,
      coordinates: {
        deletable: true,
        midpoints: true,
        draggable: true,
      }
    }
  },
  rectangle: {
    feature: {
      draggable: true,
      coordinates: {
        resizable: 'opposite',
      }
    }
  },
  "freehand-linestring": {
    feature: {
      draggable: true,
      coordinates: {
        deletable: true,
        midpoints: true,
        draggable: true,
      }
    }
  },
}
const primary = "#fff";
const shadow = "#000";
const secondary = "#000";
const fillOpacity = 0.2;

const strokeOpacity = 0.9;
const selectedStrokeOpacity = 1.0;

const VIEWBOXSIZE = 256;
const ARROWX0 = 256;
const ARROWY0 = 0;
const viewBoxWidthPx = 128;
const viewBoxHeightPx = viewBoxWidthPx;
const pixelsPerViewBoxPixel = VIEWBOXSIZE / viewBoxWidthPx;
const strokeWidth = 2;
const selectedStrokeWidth = 3;
const selectedOutlineWidth = 2;

const snappingPointSize = 2;
const editingPointSize = 4;
const editingMidPointSize = 3;
const lineWidth = 2;
const lineOpacity = 0.9;
const selectedLineWidth = 4;
const markerArrowRelativeWidth = 5;
const selectedMarkerArrowRelativeWidth = 4;

const svg = `
<svg
  width="${viewBoxWidthPx}px" height="${viewBoxHeightPx}px"
  viewBox="0 0 ${VIEWBOXSIZE} ${VIEWBOXSIZE}"
  xmlns="http://www.w3.org/2000/svg"
  preserveAspectRatio="xMaxYMax meet"
>
  <defs>
    <marker
      id="marker-arrow"
      viewBox="0 0 12 12"
      refX="12"
      refY="6"
      markerWidth="${markerArrowRelativeWidth}"
      markerHeight="${markerArrowRelativeWidth}"
      orient="auto-start-reverse"
      fill="${primary}"
      fill-opacity="${strokeOpacity}"
    >
      <path d="M 0 0 L 12 6 L 0 12 z" />
    </marker>

    <filter filterUnits="userSpaceOnUse" id="filter-shadow" x="0" y="0" width="100%" height="100%">
      <feDropShadow
        dx="${1 * pixelsPerViewBoxPixel}"
        dy="${1 * pixelsPerViewBoxPixel}"
        stdDeviation="2"
        flood-color="${shadow}"
        flood-opacity="${strokeOpacity}"
      />
    </filter>

    <mask id="mask-inner-outer">
      <circle cx="${VIEWBOXSIZE / 2}" cy="${VIEWBOXSIZE / 2}" r="${VIEWBOXSIZE / 2}" fill="${primary}" />
      <circle cx="${VIEWBOXSIZE / 2}" cy="${VIEWBOXSIZE / 2}" r="${VIEWBOXSIZE / 2 / 8}" fill="black" />
    </mask>

  </defs>

  <!-- A line with a marker -->
  <g filter="url(#filter-shadow)">
    <g mask="url(#mask-inner-outer)">
      <rect
        id="_square-spanner"
        x="0"
        y="0"
        width="${VIEWBOXSIZE / 2}"
        height="${VIEWBOXSIZE / 2}"
        fill="transparent"
      />
      <line
        x1="${212}"
        y1="${44}"
        x2="${VIEWBOXSIZE / 2}"
        y2="${VIEWBOXSIZE / 2}"
        stroke="${primary}"
        stroke-opacity="${strokeOpacity}"
        stroke-width="${strokeWidth * pixelsPerViewBoxPixel}"
      />
    </g>
    <line
      x1="${ARROWX0}"
      y1="${ARROWY0}"
      x2="${VIEWBOXSIZE / 2}"
      y2="${VIEWBOXSIZE / 2}"
      stroke-width="${strokeWidth * pixelsPerViewBoxPixel}"
      stroke="transparent"
      marker-end="url(#marker-arrow)"
    />
  </g>
</svg>
`;
const svgBlob = new Blob([svg], { type: "image/svg+xml" });
const svgBlobUrl = URL.createObjectURL(svgBlob);
const markerUrl = svgBlobUrl;

const selectedSvg = `
<svg
  width="${viewBoxWidthPx}px" height="${viewBoxHeightPx}px"
  viewBox="0 0 ${VIEWBOXSIZE} ${VIEWBOXSIZE}"
  xmlns="http://www.w3.org/2000/svg"
  preserveAspectRatio="xMaxYMax meet"
>
  <defs>
    <marker
      id="marker-arrow"
      viewBox="0 0 10 10"
      refX="10"
      refY="5"
      markerWidth="${selectedMarkerArrowRelativeWidth}"
      markerHeight="${selectedMarkerArrowRelativeWidth}"
      orient="auto-start-reverse"
      fill="${primary}"
      fill-opacity="${selectedStrokeOpacity}"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" />
    </marker>

    <filter filterUnits="userSpaceOnUse" id="filter-shadow" x="0" y="0" width="100%" height="100%">
      <feDropShadow
        dx="${selectedOutlineWidth * pixelsPerViewBoxPixel}"
        dy="${selectedOutlineWidth * pixelsPerViewBoxPixel}"
        stdDeviation="0"
        flood-color="${shadow}"
        flood-opacity="${selectedStrokeOpacity}"
      />
    </filter>

    <mask id="mask-inner-outer">
      <circle cx="${VIEWBOXSIZE / 2}" cy="${VIEWBOXSIZE / 2}" r="${VIEWBOXSIZE / 2}" fill="${primary}" />
      <circle cx="${VIEWBOXSIZE / 2}" cy="${VIEWBOXSIZE / 2}" r="${VIEWBOXSIZE / 2 / 8}" fill="black" />
    </mask>

  </defs>

  <!-- A line with a marker -->
  <g filter="url(#filter-shadow)">
    <g mask="url(#mask-inner-outer)">
      <rect
        id="_square-spanner"
        x="0"
        y="0"
        width="${VIEWBOXSIZE / 2}"
        height="${VIEWBOXSIZE / 2}"
        fill="transparent"
      />
      <line
        x1="${ARROWX0}"
        y1="${ARROWY0}"
        x2="${VIEWBOXSIZE / 2}"
        y2="${VIEWBOXSIZE / 2}"
        stroke="${primary}"
        stroke-opacity="${selectedStrokeOpacity}"
        stroke-width="${selectedStrokeWidth * pixelsPerViewBoxPixel}"
      />
    </g>
    <line
      x1="${ARROWX0}"
      y1="${ARROWY0}"
      x2="${VIEWBOXSIZE / 2}"
      y2="${VIEWBOXSIZE / 2}"
      stroke-width="${selectedStrokeWidth * pixelsPerViewBoxPixel}"
      stroke="transparent"
      marker-end="url(#marker-arrow)"
    />
  </g>
</svg>
`;
const selectedSvgBlob = new Blob([selectedSvg], { type: "image/svg+xml" });
const selectedSvgBlobUrl = URL.createObjectURL(selectedSvgBlob);
const selectedMarkerUrl = selectedSvgBlobUrl;

const editingSvg = `
<svg
  width="${viewBoxWidthPx}px" height="${viewBoxHeightPx}px"
  viewBox="0 0 ${VIEWBOXSIZE} ${VIEWBOXSIZE}"
  xmlns="http://www.w3.org/2000/svg"
  preserveAspectRatio="xMaxYMax meet"
>
  <defs>
    <marker
      id="marker-arrow"
      viewBox="0 0 10 10"
      refX="10"
      refY="5"
      markerWidth="${selectedMarkerArrowRelativeWidth}"
      markerHeight="${selectedMarkerArrowRelativeWidth}"
      orient="auto-start-reverse"
      fill="${primary}"
      fill-opacity="${selectedStrokeOpacity}"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" />
    </marker>

    <filter filterUnits="userSpaceOnUse" id="filter-shadow" x="0" y="0" width="100%" height="100%">
      <feDropShadow
        dx="${selectedOutlineWidth * pixelsPerViewBoxPixel}"
        dy="${selectedOutlineWidth * pixelsPerViewBoxPixel}"
        stdDeviation="0"
        flood-color="${shadow}"
        flood-opacity="${selectedStrokeOpacity}"
      />
    </filter>

    <mask id="mask-inner-outer">
      <circle cx="${VIEWBOXSIZE / 2}" cy="${VIEWBOXSIZE / 2}" r="${VIEWBOXSIZE / 2}" fill="${primary}" />
      <circle cx="${VIEWBOXSIZE / 2}" cy="${VIEWBOXSIZE / 2}" r="${VIEWBOXSIZE / 2 / 8}" fill="black" />
    </mask>

  </defs>

  <!-- A line with a marker -->
  <g filter="url(#filter-shadow)">
    <g mask="url(#mask-inner-outer)">
      <rect
        id="_square-spanner"
        x="0"
        y="0"
        width="${VIEWBOXSIZE / 2}"
        height="${VIEWBOXSIZE / 2}"
        fill="transparent"
      />
      <line
        x1="${ARROWX0}"
        y1="${ARROWY0}"
        x2="${VIEWBOXSIZE / 2}"
        y2="${VIEWBOXSIZE / 2}"
        stroke="${primary}"
        stroke-opacity="${selectedStrokeOpacity}"
        stroke-width="${selectedStrokeWidth * pixelsPerViewBoxPixel}"
      />
    </g>
    <line
      x1="${ARROWX0}"
      y1="${ARROWY0}"
      x2="${VIEWBOXSIZE / 2}"
      y2="${VIEWBOXSIZE / 2}"
      stroke-width="${selectedStrokeWidth * pixelsPerViewBoxPixel}"
      stroke="transparent"
      marker-end="url(#marker-arrow)"
    />
  </g>
  <circle cx="${VIEWBOXSIZE / 2}" cy="${VIEWBOXSIZE / 2}" r="${editingPointSize * pixelsPerViewBoxPixel}" fill="${primary}" stroke="black" stroke-width="${selectedOutlineWidth * pixelsPerViewBoxPixel}" />
</svg>
`;
const editingSvgBlob = new Blob([editingSvg], { type: "image/svg+xml" });
const editingSvgBlobUrl = URL.createObjectURL(editingSvgBlob);
const editingMarkerUrl = editingSvgBlobUrl;

const markerAnchor = "center";
const markerWidth = svg.match(`(width.*?px)`)?.at(0)?.split(`"`)?.at(1)?.split("px")?.at(0);
const markerHeight = svg.match(`(height.*?px)`)?.at(0)?.split(`"`)?.at(1)?.split("px")?.at(0);

const lineStringValidator: Validator = (feature, { updateType }) => {
  return { valid: outOfBoundsValidator(feature, { updateType }).valid};
}
const polygonValidator: Validator = (feature, { updateType }) => {
  return { valid: outOfBoundsValidator(feature, { updateType }).valid && ValidateNotSelfIntersecting(feature).valid };
}

export const modeFactory: ModeFactory = () => {
  return [
    // Default mode that can only select.
    new TerraDrawSelectMode({
      modeName: "select",
      pointerDistance: defaultPointerDistance,
      flags: selectFlags,
      keyEvents: defaultKeyEvents,
      styles: {
        selectedMarkerUrl: selectedMarkerUrl,
        selectedMarkerWidth: markerWidth ? parseInt(markerWidth) : undefined,
        selectedMarkerHeight: markerHeight ? parseInt(markerHeight) : undefined,
        selectedMarkerAnchor: markerAnchor,
        selectedLineStringColor: primary,
        selectedPolygonColor: primary,
        selectedPolygonFillOpacity: fillOpacity,
        selectedPolygonOutlineColor: primary,
        selectedPolygonOutlineWidth: selectedLineWidth,
        selectionPointWidth: 0,
      },
    }),
    // This is not a mode for users. It can select, modify, and delete all features.
    // There is too much power here, and too much handling.
    // Instead, a hidden "isolated-edit" mode is used for editing specific features.
    // Its capabilities and styling are derived here.
    new TerraDrawSelectMode({
      modeName: "edit",
      pointerDistance: defaultPointerDistance,
      // @ts-ignore: resizeable: 'opposite' triggers this, despite being valid
      flags: editFlags,
      styles: {
        selectedMarkerUrl: editingMarkerUrl,
        selectedMarkerWidth: markerWidth ? parseInt(markerWidth) : undefined,
        selectedMarkerHeight: markerHeight ? parseInt(markerHeight) : undefined,
        selectedMarkerAnchor: markerAnchor,

        selectedLineStringColor: primary,

        selectedPolygonColor: primary,
        selectedPolygonFillOpacity: fillOpacity,
        selectedPolygonOutlineColor: primary,
        selectedPolygonOutlineWidth: selectedLineWidth,

        selectionPointColor: primary,
        selectionPointOutlineColor: secondary,
        selectionPointWidth: editingPointSize,
        selectionPointOutlineWidth: 1,

        midPointColor: primary,
        midPointOutlineColor: secondary,
        midPointWidth: editingMidPointSize,
        midPointOutlineWidth: 1,

        // selectedPointColor
        // selectedPointWidth
        // selectedPointOpacity
        // selectedPointOutlineColor
        // selectedPointOutlineWidth
        // selectedPointOutlineOpacity

        // selectedMarkerUrl
        // selectedMarkerHeight
        // selectedMarkerWidth

        // selectedLineStringColor
        // selectedLineStringWidth
        // selectedLineStringOpacity
        // selectedLineStringDash

        // selectedPolygonColor
        // selectedPolygonFillOpacity
        // selectedPolygonOutlineColor
        // selectedPolygonOutlineOpacity
        // selectedPolygonOutlineWidth

        // selectionPointWidth
        // selectionPointColor
        // selectionPointOpacity
        // selectionPointOutlineColor
        // selectionPointOutlineWidth
        // selectionPointOutlineOpacity

        // midPointColor
        // midPointOutlineColor
        // midPointOpacity
        // midPointWidth
        // midPointOutlineWidth
        // midPointOutlineOpacity
      },
    }),
    // Isolated edit mode, identical to edit mode.
    new TerraDrawSelectMode({
      modeName: ISOLATED_EDIT_MODE_NAME,
      pointerDistance: defaultPointerDistance,
      keyEvents: defaultKeyEvents,
      allowManualSelection: false,
      // @ts-ignore: resizeable: 'opposite' triggers this, despite being valid
      flags: editFlags,
      styles: {
        selectedMarkerUrl: editingMarkerUrl,
        selectedMarkerWidth: markerWidth ? parseInt(markerWidth) : undefined,
        selectedMarkerHeight: markerHeight ? parseInt(markerHeight) : undefined,
        selectedMarkerAnchor: markerAnchor,
        selectedLineStringColor: primary,
        selectedPolygonColor: primary,
        selectedPolygonFillOpacity: fillOpacity,
        selectedPolygonOutlineColor: primary,
        selectedPolygonOutlineWidth: selectedLineWidth,
        selectionPointColor: primary,
        selectionPointOutlineColor: secondary,
        selectionPointWidth: editingPointSize,
        midPointColor: primary,
        midPointOutlineColor: secondary,
        midPointWidth: editingMidPointSize,
        midPointOutlineWidth: 1,
      },
    }),
    new TerraDrawMarkerMode({
      pointerDistance: defaultPointerDistance,
      validation: outOfBoundsValidator,
      styles: {
        markerUrl: ({properties}) => properties?._currentlyHovering ? selectedMarkerUrl : markerUrl,
        markerWidth: markerWidth ? parseInt(markerWidth) : undefined,
        markerHeight: markerHeight ? parseInt(markerHeight) : undefined,
        markerAnchor: markerAnchor,
      },
    }),
    new TerraDrawPolyLineMode({
      pointerDistance: defaultPointerDistance,
      validation: polygonValidator,
      styles: {
        lineStringColor: primary,
        lineStringOpacity: lineOpacity,
        lineStringWidth: ({properties}) => properties?._currentlyHovering ? selectedLineWidth : lineWidth,
        polygonFillColor: primary,
        polygonFillOpacity: ({properties}) => properties?._currentlyHovering ? fillOpacity : (fillOpacity / 2),
        polygonOutlineColor: primary,
        polygonOutlineOpacity: lineOpacity,
        polygonOutlineWidth: ({properties}) => properties?._currentlyHovering ? selectedLineWidth : lineWidth,
        closingPointColor: primary,
        // closingPointOpacity: ,
        closingPointWidth: editingPointSize,
        closingPointOutlineColor: secondary,
        // closingPointOutlineOpacity: ,
        // closingPointOutlineWidth: ,
        snappingPointColor: primary,
        // snappingPointOpacity: ,
        snappingPointWidth: snappingPointSize,
        snappingPointOutlineColor: secondary,
        // snappingPointOutlineOpacity: ,
        // snappingPointOutlineWidth: ,
        coordinatePointColor: primary,
        // coordinatePointOpacity: ,
        coordinatePointWidth: editingMidPointSize,
        coordinatePointOutlineColor: secondary,
        // coordinatePointOutlineOpacity: ,
        // coordinatePointOutlineWidth: ,
      }
    }),
    new TerraDrawRectangleMode({
      pointerDistance: defaultPointerDistance,
      validation: polygonValidator,
      drawInteraction: "click-move-or-drag",
      styles: {
        fillColor: primary,
        fillOpacity: ({properties}) => properties?._currentlyHovering ? fillOpacity : (fillOpacity / 2),
        outlineColor: primary,
        outlineOpacity: lineOpacity,
        outlineWidth: ({properties}) => properties?._currentlyHovering ? selectedLineWidth : lineWidth,
        coordinatePointWidth: editingMidPointSize,
        coordinatePointColor: primary,
        // coordinatePointOpacity: ,
        // coordinatePointOutlineWidth: ,
        coordinatePointOutlineColor: secondary,
        // coordinatePointOutlineOpacity: ,
      },
    }),
    new TerraDrawFreehandLineStringMode({
      pointerDistance: defaultPointerDistance,
      validation: lineStringValidator,
      drawInteraction: "click-move-or-drag",
      // minDistance: 50,
      styles: {
        lineStringWidth: ({properties}) => properties?._currentlyHovering ? selectedLineWidth : lineWidth,
        lineStringColor: primary,
        lineStringOpacity: lineOpacity,
        // lineStringDash: ,
        // coordinatePointWidth: ,
        // coordinatePointColor: ,
        // coordinatePointOpacity: ,
        // coordinatePointOutlineWidth: ,
        // coordinatePointOutlineColor: ,
        // coordinatePointOutlineOpacity: ,
        closingPointColor: primary,
        // closingPointOpacity: ,
        closingPointWidth: editingPointSize,
        closingPointOutlineColor: secondary,
        // closingPointOutlineWidth: ,
        // closingPointOutlineOpacity: ,
      },
    }),
  ];
}
