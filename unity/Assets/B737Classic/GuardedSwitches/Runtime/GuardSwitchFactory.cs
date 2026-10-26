using System;
using UnityEngine;

namespace B737Classic.GuardedSwitches
{
    /// <summary>
    /// Independent parametrically sized prototype for each of the 17 guards.
    /// Visual proportions are DRAFT until native-pixel sockets + real aircraft
    /// hardware dimensions are signed off. This does not alter existing overlays.
    /// </summary>
    public static class GuardSwitchFactory
    {
        public static GameObject CreatePreview(GuardBlueprint spec)
        {
            if (spec == null || spec.geometry == null || spec.material == null || spec.motion == null)
                throw new ArgumentNullException(nameof(spec));

            if (!Enum.TryParse(spec.hingeDirection, false, out GuardHinge direction))
                throw new InvalidOperationException("Owner hinge not confirmed for " + spec.controlId);

            var g = spec.geometry;
            var root = new GameObject("Guard_" + spec.controlId);
            root.transform.localScale = Vector3.one;

            // Each component is a distinct body, not flattened screenshot art.
            Material surround = NewMaterial("Mount_" + spec.controlId, "#111418", 0.30f, 0.75f);
            Material metal = NewMaterial("Hinge_" + spec.controlId, "#777C84", 0.70f, 0.34f);
            Material lid = NewMaterial(
                "Cover_" + spec.controlId,
                spec.material.swatchHex,
                spec.material.metallic,
                spec.material.roughness);

            GameObject mount = GameObject.CreatePrimitive(PrimitiveType.Cube);
            mount.name = "Mount_Provisional";
            mount.transform.SetParent(root.transform, false);
            mount.transform.localPosition = new Vector3(0f, 0f, -0.011f);
            mount.transform.localScale = new Vector3(g.previewWidth + 0.025f, g.previewHeight + 0.025f, 0.017f);
            mount.GetComponent<MeshRenderer>().sharedMaterial = surround;

            // Switch hardware is now built independently by GuardActuatorFactory.
            // No generic pill-shaped lever remains in the guarded cover assembly.

            Vector3 anchor = GuardSwitchView.LocalPivot(g.previewWidth, g.previewHeight, direction);
            GameObject fixedKnuckle = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            fixedKnuckle.name = "FixedHinge_Mount";
            fixedKnuckle.transform.SetParent(root.transform, false);
            fixedKnuckle.transform.localPosition = anchor;
            fixedKnuckle.transform.localRotation =
                direction == GuardHinge.Up || direction == GuardHinge.Down
                    ? Quaternion.Euler(0f, 0f, 90f) : Quaternion.identity;
            float shaftLength =
                direction == GuardHinge.Up || direction == GuardHinge.Down
                    ? g.previewWidth * 0.87f : g.previewHeight * 0.87f;
            // Cylinder primitive is 2 units tall: scale Y by length/2.
            fixedKnuckle.transform.localScale =
                new Vector3(0.009f, shaftLength * 0.5f, 0.009f);
            fixedKnuckle.GetComponent<MeshRenderer>().sharedMaterial = metal;

            GameObject hinge = new GameObject("HingePivot_FixedAxis");
            hinge.transform.SetParent(root.transform, false);
            hinge.transform.localPosition = anchor;
            hinge.transform.localRotation = Quaternion.identity;
            hinge.transform.localScale = Vector3.one;

            GameObject cover = new GameObject("OneImmutableGuardCover");
            cover.transform.SetParent(hinge.transform, false);
            // Opposite XY offset means the physical cover edge sits ON the hinge.
            cover.transform.localPosition =
                -new Vector3(anchor.x, anchor.y, 0f) +
                new Vector3(0f, 0f, g.previewThickness * 0.5f + 0.004f);
            cover.transform.localRotation = Quaternion.identity;
            cover.transform.localScale = Vector3.one;

            MeshFilter mf = cover.AddComponent<MeshFilter>();
            mf.sharedMesh = GuardCoverMesh.Create(
                spec.controlId, g.previewWidth, g.previewHeight,
                g.previewThickness, g.previewCornerRadius, g.contourProfile);
            MeshRenderer mr = cover.AddComponent<MeshRenderer>();
            mr.sharedMaterial = lid;
            MeshCollider hit = cover.AddComponent<MeshCollider>();
            hit.sharedMesh = mf.sharedMesh;

            GuardSwitchView view = root.AddComponent<GuardSwitchView>();
            view.Initialize(spec, hinge.transform, cover.transform, mf, mr);
            if (!view.InvariantsHold())
                throw new InvalidOperationException("Guard identity invariant failed on creation: " + spec.controlId);

            GuardPreviewClickTarget clickCover = cover.AddComponent<GuardPreviewClickTarget>();
            clickCover.target = view;
            clickCover.underlyingSwitch = false;
            // Dedicated socket + ring + satin stem + shaped grip + detent pivot.
            // The actuator remains physically separate from the moving guard.
            GuardActuatorFactory.CreatePreview(spec, root.transform, view);

            return root;
        }

        private static Material NewMaterial(
            string name, string hex, float metallic, float roughness)
        {
            Shader shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null) shader = Shader.Find("Standard");
            if (shader == null) shader = Shader.Find("Sprites/Default");
            if (shader == null) throw new InvalidOperationException("No supported Unity material shader installed.");
            var material = new Material(shader) { name = name };
            if (!ColorUtility.TryParseHtmlString(hex, out Color c))
                throw new InvalidOperationException("Invalid material swatch " + hex);
            material.color = c;
            if (material.HasProperty("_Metallic"))
                material.SetFloat("_Metallic", Mathf.Clamp01(metallic));
            if (material.HasProperty("_Smoothness"))
                material.SetFloat("_Smoothness", 1f - Mathf.Clamp01(roughness));
            else if (material.HasProperty("_Glossiness"))
                material.SetFloat("_Glossiness", 1f - Mathf.Clamp01(roughness));
            return material;
        }
    }
}
