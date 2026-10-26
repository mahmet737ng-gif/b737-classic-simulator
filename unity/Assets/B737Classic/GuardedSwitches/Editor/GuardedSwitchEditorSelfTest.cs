#if UNITY_EDITOR
using System;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace B737Classic.GuardedSwitches.Editor
{
    /// <summary>
    /// Real Unity Editor 3-pass runtime geometry test. Can run from menu, or
    /// -batchmode -executeMethod B737Classic.GuardedSwitches.Editor.GuardedSwitchEditorSelfTest.Run
    /// It verifies 17 instantiated cover geometries; NOT accuracy to a Boeing photo.
    /// </summary>
    public static class GuardedSwitchEditorSelfTest
    {
        private const string Catalog = "Assets/B737Classic/GuardedSwitches/Resources/GuardedSwitchBlueprints.json";

        [MenuItem("B737 Classic/Guarded Switches/Test 17 preview guards x3")]
        public static void Run()
        {
            TextAsset source = AssetDatabase.LoadAssetAtPath<TextAsset>(Catalog);
            GuardBlueprintCatalog data = GuardBlueprintCatalog.Load(source);
            int tested = 0;

            for (int pass = 1; pass <= 3; ++pass)
            {
                foreach (GuardBlueprint spec in data.controls)
                {
                    GameObject root = GuardSwitchFactory.CreatePreview(spec);
                    try
                    {
                        GuardSwitchView controller = root.GetComponent<GuardSwitchView>();
                        MeshFilter mf = root.GetComponentsInChildren<MeshFilter>(true)
                            .Single(x => x.gameObject.name == "OneImmutableGuardCover");
                        Transform cover = mf.transform;
                        Transform pivot = cover.parent;
                        MeshRenderer render = cover.GetComponent<MeshRenderer>();
                        Mesh originalMesh = mf.sharedMesh;
                        Material originalMaterial = render.sharedMaterial;
                        Color originalColor = originalMaterial.color;
                        Vector3 originalScale = cover.localScale;
                        Vector3 originalOffset = cover.localPosition;
                        Vector3 originalSize = originalMesh.bounds.size;
                        GuardHinge direction = controller.Direction;

                        Vector3 expectedPivot = GuardSwitchView.LocalPivot(
                            spec.geometry.previewWidth, spec.geometry.previewHeight, direction);
                        Require((pivot.localPosition - expectedPivot).sqrMagnitude < 1e-12f,
                            spec.controlId + " hinge center");

                        controller.SetOpen(false, true);
                        Require(controller.InvariantsHold(), spec.controlId + " closed identity");
                        Quaternion closed = pivot.localRotation;

                        controller.SetOpen(true, true);
                        Require(controller.InvariantsHold(), spec.controlId + " open identity");
                        Quaternion opened = pivot.localRotation;
                        Require(Quaternion.Angle(closed, opened) > 45f,
                            spec.controlId + " must rotate around fixed hinge");

                        Vector3 freeEdge = FreeEdge(direction,
                            spec.geometry.previewWidth, spec.geometry.previewHeight);
                        Vector3 swung = opened * freeEdge;
                        Require(swung.z > 0.0001f,
                            spec.controlId + " cover opens outward, not inside panel");
                        Require(Mathf.Abs(swung.magnitude - freeEdge.magnitude) < 0.000001f,
                            spec.controlId + " opening preserves physical length");

                        Require(mf.sharedMesh == originalMesh, spec.controlId + " no mesh swapping");
                        Require(render.sharedMaterial == originalMaterial,
                            spec.controlId + " no material swapping");
                        Require(render.sharedMaterial.color == originalColor,
                            spec.controlId + " no color drift");
                        Require(cover.localScale == originalScale,
                            spec.controlId + " no scale changes");
                        Require(cover.localPosition == originalOffset,
                            spec.controlId + " no cover offset animation");
                        Require(originalMesh.bounds.size == originalSize,
                            spec.controlId + " no shape deformation");

                        controller.SetOpen(false, true);
                        Require(controller.InvariantsHold(), spec.controlId + " close-after-open identity");
                        Require(Quaternion.Angle(closed, pivot.localRotation) < 0.001f,
                            spec.controlId + " returns to exact closed pose");
                        tested++;
                    }
                    finally
                    {
                        UnityEngine.Object.DestroyImmediate(root);
                    }
                }
            }

            Debug.Log("UNITY COVER IDENTITY PASS: " + tested +
                      " instances (17 guards x 3 repetitions), fixed hinge and body identity.");
        }

        private static Vector3 FreeEdge(GuardHinge hinge, float width, float height)
        {
            switch (hinge)
            {
                case GuardHinge.Up: return Vector3.down * height;
                case GuardHinge.Down: return Vector3.up * height;
                case GuardHinge.Left: return Vector3.right * width;
                case GuardHinge.Right: return Vector3.left * width;
                default: throw new ArgumentOutOfRangeException(nameof(hinge));
            }
        }

        private static void Require(bool ok, string explanation)
        {
            if (!ok) throw new InvalidOperationException("Guard self-test failed: " + explanation);
        }
    }
}
#endif
