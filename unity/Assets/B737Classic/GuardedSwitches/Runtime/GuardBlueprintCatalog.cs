using System;
using System.Collections.Generic;
using UnityEngine;

namespace B737Classic.GuardedSwitches
{
    // The JSON catalog deliberately separates OWNER-CONFIRMED HINGES from
    // UNVERIFIED preview geometry. No preview unit is an aircraft millimetre.
    [Serializable]
    public sealed class GuardBlueprintCatalog
    {
        public string schema;
        public string approvalStatus;
        public GuardBlueprint[] controls;

        public static GuardBlueprintCatalog Load(TextAsset source)
        {
            if (source == null) throw new ArgumentNullException(nameof(source));
            GuardBlueprintCatalog catalog = JsonUtility.FromJson<GuardBlueprintCatalog>(source.text);
            if (catalog == null || catalog.controls == null || catalog.controls.Length != 17)
                throw new InvalidOperationException("Expected exactly 17 owner-confirmed guarded controls.");

            var ids = new HashSet<string>(StringComparer.Ordinal);
            foreach (GuardBlueprint entry in catalog.controls)
            {
                if (entry == null || string.IsNullOrEmpty(entry.controlId) || !ids.Add(entry.controlId))
                    throw new InvalidOperationException("Missing or duplicated guard identity.");
                if (!Enum.TryParse(entry.hingeDirection, false, out GuardHinge _))
                    throw new InvalidOperationException("Unconfirmed hinge: " + entry.controlId);
                if (entry.geometry == null || entry.material == null || entry.motion == null || entry.switchAppearance == null ||
                    entry.geometry.previewWidth <= 0f || entry.geometry.previewHeight <= 0f ||
                    entry.geometry.previewThickness <= 0f || entry.geometry.previewCornerRadius <= 0f)
                    throw new InvalidOperationException("Missing preview geometry: " + entry.controlId);
                if (string.IsNullOrEmpty(entry.geometry.contourProfile))
                    throw new InvalidOperationException("Missing control-specific cover contour: " + entry.controlId);
                if (entry.geometry.approval != "UNVERIFIED_DO_NOT_USE_AS_FACTORY_DIMENSIONS")
                    throw new InvalidOperationException("Preview may not be labelled aircraft-certified: " + entry.controlId);
                if (!entry.material.sharedAcrossPoses)
                    throw new InvalidOperationException("Open and closed material must be identical: " + entry.controlId);
                GuardActuatorAppearance actuator = entry.switchAppearance;
                if (actuator.detentLabels == null || actuator.detentLabels.Length < 2 ||
                    actuator.detentLabels.Length > 3 ||
                    Array.IndexOf(actuator.detentLabels, actuator.initialState) < 0 ||
                    actuator.shaftRelativeScale <= 0f || actuator.gripRelativeScale <= 0f ||
                    actuator.detentTiltDegrees <= 0f || !actuator.meshMaterialInvariant ||
                    !actuator.transformOnlyAnimation)
                    throw new InvalidOperationException("Invalid static guarded actuator definition: " + entry.controlId);
                if (actuator.momentary && (actuator.detentLabels.Length != 2 ||
                    actuator.detentLabels[0] != "REST" || actuator.detentLabels[1] != "ACTUATE"))
                    throw new InvalidOperationException("Transient generator drive release cannot be modelled as stable positions: " + entry.controlId);
            }
            return catalog;
        }
    }

    public enum GuardHinge { Up, Down, Left, Right }

    [Serializable]
    public sealed class GuardBlueprint
    {
        public string controlId;
        public string displayName;
        public string panelId;
        public string hingeDirection;
        public string physicalFamily;
        public GuardSourceMount sourceMount;
        public GuardPreviewGeometry geometry;
        public GuardCoverMaterial material;
        public GuardMotion motion;
        public GuardActuatorAppearance switchAppearance;
    }

    [Serializable]
    public sealed class GuardActuatorAppearance
    {
        public string family;
        public string actuatorType;
        public string detentAxis;
        public string[] detentLabels;
        public string initialState;
        public bool momentary;
        public float shaftRelativeScale;
        public float gripRelativeScale;
        public float shaftLengthScale;
        public string faceHex;
        public string ringHex;
        public string shaftHex;
        public string gripHex;
        public float shaftMetallic;
        public float shaftRoughness;
        public float gripMetallic;
        public float gripRoughness;
        public float detentTiltDegrees;
        public bool transformOnlyAnimation;
        public bool meshMaterialInvariant;
        public string designStage;
        public string dimensions;
    }

    [Serializable]
    public sealed class GuardSourceMount
    {
        public int[] sourceRectNativePx;
        public float[] sourceCenterNativePx;
        public string rectEvidence;
        public bool requiresCalibratedSocket;
    }

    [Serializable]
    public sealed class GuardPreviewGeometry
    {
        public float previewWidth;
        public float previewHeight;
        public float previewThickness;
        public float previewCornerRadius;
        // Reference-informed visual contour, authored ONCE and invariant in pose.
        public string contourProfile;
        public float referenceAspectRatioHint;
        public string coverAspectSource;
        public string approval;
    }

    [Serializable]
    public sealed class GuardCoverMaterial
    {
        public string materialIdentity;
        public string swatchHex;
        public bool sharedAcrossPoses;
        public float metallic;
        public float roughness;
    }

    [Serializable]
    public sealed class GuardMotion
    {
        public float openAngleDegrees;
        public float durationSeconds;
        public string anchorEdge;
        public string angleEvidence;
    }
}
