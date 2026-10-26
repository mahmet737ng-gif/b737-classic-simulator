#if UNITY_EDITOR
using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace B737Classic.GuardedSwitches.Editor
{
    /// <summary>
    /// Runs in a project that imported Assets/B737Classic/GuardedSwitches.
    /// Saves each preview mesh/material as a real asset, then saves a prefab.
    /// NEVER overwrites the existing Unified cockpit or locked images.
    /// </summary>
    public static class GuardedSwitchPrefabGenerator
    {
        private const string Root = "Assets/B737Classic/GuardedSwitches";
        private const string CatalogPath = Root + "/Resources/GuardedSwitchBlueprints.json";
        private const string Generated = Root + "/GeneratedPreviews_v2";

        [MenuItem("B737 Classic/Guarded Switches/Generate 17 corrected V2 PREVIEW Prefabs")]
        public static void Generate()
        {
            TextAsset source = AssetDatabase.LoadAssetAtPath<TextAsset>(CatalogPath);
            if (source == null)
                throw new FileNotFoundException("Import the B737Classic GuardedSwitches Assets folder.", CatalogPath);

            GuardBlueprintCatalog catalog = GuardBlueprintCatalog.Load(source);
            if (!AssetDatabase.IsValidFolder(Generated))
                AssetDatabase.CreateFolder(Root, "GeneratedPreviews_v2");

            int created = 0;
            int skipped = 0;
            foreach (GuardBlueprint spec in catalog.controls)
            {
                string filename = spec.controlId;
                string prefabPath = Generated + "/" + filename + "_PREVIEW.prefab";
                // Unapproved previews and any already-approved assets are never overwritten.
                if (AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath) != null)
                {
                    skipped++;
                    Debug.Log("Preserving existing guarded-switch prefab: " + prefabPath);
                    continue;
                }

                GameObject root = GuardSwitchFactory.CreatePreview(spec);
                try
                {
                    MeshFilter cover = root.GetComponentsInChildren<MeshFilter>(true)
                        .Single(filter => filter.gameObject.name == "OneImmutableGuardCover");
                    string meshPath = Generated + "/" + filename + "_singleCoverMesh.asset";
                    if (AssetDatabase.LoadAssetAtPath<Mesh>(meshPath) != null)
                        throw new IOException("Existing mesh must be reviewed before regeneration: " + meshPath);
                    AssetDatabase.CreateAsset(cover.sharedMesh, meshPath);
                    cover.sharedMesh = AssetDatabase.LoadAssetAtPath<Mesh>(meshPath);
                    cover.GetComponent<MeshCollider>().sharedMesh = cover.sharedMesh;

                    foreach (MeshRenderer renderer in root.GetComponentsInChildren<MeshRenderer>(true))
                    {
                        Material material = renderer.sharedMaterial;
                        if (material == null || AssetDatabase.Contains(material)) continue;
                        string materialPath = Generated + "/" + filename + "_" + material.name + ".mat";
                        if (AssetDatabase.LoadAssetAtPath<Material>(materialPath) != null)
                            throw new IOException("Existing material must be reviewed: " + materialPath);
                        AssetDatabase.CreateAsset(material, materialPath);
                        renderer.sharedMaterial = AssetDatabase.LoadAssetAtPath<Material>(materialPath);
                    }

                    bool success;
                    PrefabUtility.SaveAsPrefabAsset(root, prefabPath, out success);
                    if (!success)
                        throw new IOException("Unity prefab serialization failed: " + prefabPath);
                    created++;
                }
                finally
                {
                    UnityEngine.Object.DestroyImmediate(root);
                }
            }

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log($"B737 guarded covers: {created} preview prefabs generated, " +
                      $"{skipped} preserved. Not certified for cockpit mounting.");
        }

        [MenuItem("B737 Classic/Guarded Switches/Verify 17 corrected V2 PREVIEW Prefabs")]
        public static void VerifyGenerated()
        {
            var source = AssetDatabase.LoadAssetAtPath<TextAsset>(CatalogPath);
            GuardBlueprintCatalog catalog = GuardBlueprintCatalog.Load(source);
            int checkedCount = 0;
            foreach (GuardBlueprint spec in catalog.controls)
            {
                string path = Generated + "/" + spec.controlId + "_PREVIEW.prefab";
                GameObject prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                if (prefab == null) throw new FileNotFoundException("Missing preview prefab", path);
                GuardSwitchView view = prefab.GetComponent<GuardSwitchView>();
                MeshFilter[] meshes = prefab.GetComponentsInChildren<MeshFilter>(true);
                MeshRenderer[] renderers = prefab.GetComponentsInChildren<MeshRenderer>(true);
                if (view == null || meshes.Count(m => m.gameObject.name == "OneImmutableGuardCover") != 1 ||
                    renderers.Count(r => r.gameObject.name == "OneImmutableGuardCover") != 1)
                    throw new InvalidOperationException("Prefab identity structure incorrect: " + spec.controlId);
                checkedCount++;
            }
            Debug.Log("PREVIEW STRUCTURE PASSED: " + checkedCount + " prefabs. Photo size QA is pending.");
        }
    }
}
#endif
