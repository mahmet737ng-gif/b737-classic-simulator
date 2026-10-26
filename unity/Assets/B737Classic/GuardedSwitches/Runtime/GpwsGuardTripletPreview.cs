using System;
using UnityEngine;

namespace B737Classic.GuardedSwitches
{
    /// <summary>
    /// Three PHYSICALLY SEPARATE guard covers with the EXACT SAME cover
    /// geometry and base material. This is a preview grouping only:
    /// it does not claim measured spacing or actual cockpit placement.
    /// </summary>
    public static class GpwsGuardTripletPreview
    {
        public static readonly string[] OrderedControlIds =
        {
            "gpws-flap-inhibit",
            "gpws-gear-inhibit",
            "gpws-terrain-inhibit"
        };

        public static GameObject Create(GuardBlueprintCatalog catalog)
        {
            if (catalog == null || catalog.controls == null)
                throw new ArgumentNullException(nameof(catalog));

            var controls = new GuardBlueprint[OrderedControlIds.Length];
            for (int i = 0; i < OrderedControlIds.Length; ++i)
            {
                string key = OrderedControlIds[i];
                foreach (GuardBlueprint candidate in catalog.controls)
                {
                    if (candidate.controlId == key)
                    {
                        if (controls[i] != null)
                            throw new InvalidOperationException("Duplicated GPWS control: " + key);
                        controls[i] = candidate;
                    }
                }
                if (controls[i] == null)
                    throw new InvalidOperationException("Missing GPWS physical guard: " + key);
            }

            for (int i = 1; i < controls.Length; ++i)
                AssertEqualCover(controls[0], controls[i]);

            GameObject group = new GameObject("GPWS_3_Independent_Identical_Guards_PREVIEW");
            // Spacing is purely a preview arrangement. Real cockpit mounts
            // must come from native source pixels, NOT from this grouping.
            float spacing = controls[0].geometry.previewWidth + 0.045f;
            for (int i = 0; i < controls.Length; ++i)
            {
                GameObject guard = GuardSwitchFactory.CreatePreview(controls[i]);
                guard.transform.SetParent(group.transform, false);
                guard.transform.localPosition = new Vector3((i - 1) * spacing, 0f, 0f);
                guard.transform.localScale = Vector3.one;
            }

            return group;
        }

        public static void AssertEqualCover(GuardBlueprint a, GuardBlueprint b)
        {
            if (a == null || b == null || a.geometry == null || b.geometry == null ||
                a.material == null || b.material == null)
                throw new ArgumentException("GPWS geometry/material missing.");

            GuardPreviewGeometry x = a.geometry, y = b.geometry;
            if (a.hingeDirection != "Up" || b.hingeDirection != "Up" ||
                x.previewWidth != y.previewWidth ||
                x.previewHeight != y.previewHeight ||
                x.previewThickness != y.previewThickness ||
                x.previewCornerRadius != y.previewCornerRadius ||
                x.contourProfile != y.contourProfile ||
                a.material.swatchHex != b.material.swatchHex ||
                a.material.metallic != b.material.metallic ||
                a.material.roughness != b.material.roughness)
                throw new InvalidOperationException(
                    "Owner-approved GPWS triplet must be three DISTINCT physical covers " +
                    "with IDENTICAL size, shape, material and Up hinge.");

            if (x.contourProfile != "gpws-three-identical" ||
                a.material.swatchHex != "#202125")
                throw new InvalidOperationException(
                    "GPWS guard profile or black material is not the approved preview specification.");
        }
    }
}
