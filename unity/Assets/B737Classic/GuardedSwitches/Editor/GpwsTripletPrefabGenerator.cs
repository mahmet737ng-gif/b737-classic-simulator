#if UNITY_EDITOR
using System;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace B737Classic.GuardedSwitches.Editor
{
    /// <summary>
    /// Groups three EXISTING independently saved GPWS prefabs. The group's
    /// spacing is for demonstration only, not measured aircraft placement.
    /// Each cover keeps its own mesh, material and fixed hinge pivot.
    /// </summary>
    public static class GpwsTripletPrefabGenerator
    {
        private const string Root = "Assets/B737Classic/GuardedSwitches";
        private const string Generated = Root + "/GeneratedPreviews_v1";
        private const string Catalog = Root + "/Resources/GuardedSwitchBlueprints.json";
        private const string Target = Generated + "/GPWS_3_Independent_Identical_PREVIEW.prefab";

        [MenuItem("B737 Classic/Guarded Switches/Generate GPWS 3-Cover PREVIEW Assembly")]
        public static void Generate()
        {
            if (AssetDatabase.LoadAssetAtPath<GameObject>(Target) != null)
            {
                Debug.Log("Existing GPWS three-cover prefab kept untouched: " + Target);
                return;
            }

            // Creates the independent child meshes/materials if they are missing,
            // but never replaces existing saved prefabs.
            GuardedSwitchPrefabGenerator.Generate();
            var blueprint = AssetDatabase.LoadAssetAtPath<TextAsset>(Catalog);
            GuardBlueprintCatalog parsed = GuardBlueprintCatalog.Load(blueprint);
            var ids = GpwsGuardTripletPreview.OrderedControlIds;
            GuardBlueprint reference = null;
            float spacing = 0f;
            GameObject assembly = new GameObject("GPWS_3_Independent_Identical_PREVIEW");
            try
            {
                for (int i = 0; i < ids.Length; ++i)
                {
                    GuardBlueprint spec = Array.Find(parsed.controls, c => c.controlId == ids[i]);
                    if (spec == null) throw new InvalidOperationException("Missing GPWS " + ids[i]);
                    if (reference != null) GpwsGuardTripletPreview.AssertEqualCover(reference, spec);
                    else
                    {
                        reference = spec;
                        spacing = spec.geometry.previewWidth + 0.045f;
                    }

                    string prefabPath = Generated + "/" + ids[i] + "_PREVIEW.prefab";
                    GameObject source = AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath);
                    if (source == null) throw new FileNotFoundException("Missing child guard prefab", prefabPath);
                    GameObject instance = PrefabUtility.InstantiatePrefab(source) as GameObject;
                    if (instance == null) throw new InvalidOperationException("Unable to instantiate " + prefabPath);
                    instance.transform.SetParent(assembly.transform, false);
                    instance.transform.localPosition = new Vector3((i - 1) * spacing, 0f, 0f);
                    instance.transform.localRotation = Quaternion.identity;
                    instance.transform.localScale = Vector3.one;
                }

                bool saved;
                PrefabUtility.SaveAsPrefabAsset(assembly, Target, out saved);
                if (!saved) throw new IOException("Failed saving GPWS triplet prefab " + Target);
                AssetDatabase.SaveAssets();
                Debug.Log("GPWS triplet PREVIEW: three independent equal guards stored at " + Target);
            }
            finally { UnityEngine.Object.DestroyImmediate(assembly); }
        }
    }
}
