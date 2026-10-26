using System;
using System.Collections.Generic;
using UnityEngine;

namespace B737Classic.GuardedSwitches
{
    /// <summary>
    /// A single extruded rounded cover mesh for BOTH poses.
    /// Open/closed animation NEVER swaps this mesh or scales its vertices.
    /// Geometry is provisional until a measured aircraft-specific photograph/socket
    /// supplies the correct width, thickness and edge profile.
    /// </summary>
    public static class GuardCoverMesh
    {
        public static Mesh Create(string identity, float width, float height, float thickness, float radius)
        {
            if (width <= 0f || height <= 0f || thickness <= 0f)
                throw new ArgumentOutOfRangeException(nameof(width), "Positive cover dimensions required.");
            radius = Mathf.Clamp(radius, 0.0001f, Mathf.Min(width, height) * 0.45f);
            const int segmentsPerCorner = 8;
            var outline = new List<Vector2>(4 * (segmentsPerCorner + 1));
            var corners = new[] {
                new Vector2(width * 0.5f - radius, height * 0.5f - radius),
                new Vector2(-width * 0.5f + radius, height * 0.5f - radius),
                new Vector2(-width * 0.5f + radius, -height * 0.5f + radius),
                new Vector2(width * 0.5f - radius, -height * 0.5f + radius)
            };
            for (int corner = 0; corner < 4; ++corner)
            {
                for (int s = 0; s <= segmentsPerCorner; ++s)
                {
                    float radians = (corner * 90f + s * 90f / segmentsPerCorner) * Mathf.Deg2Rad;
                    outline.Add(corners[corner] +
                                new Vector2(Mathf.Cos(radians), Mathf.Sin(radians)) * radius);
                }
            }

            int n = outline.Count;
            var vertices = new List<Vector3>(n * 2 + 2);
            var uvs = new List<Vector2>(n * 2 + 2);
            float halfDepth = thickness * 0.5f;
            for (int side = 0; side < 2; ++side)
            {
                float z = side == 0 ? halfDepth : -halfDepth;
                foreach (Vector2 p in outline)
                {
                    vertices.Add(new Vector3(p.x, p.y, z));
                    uvs.Add(new Vector2((p.x / width) + 0.5f, (p.y / height) + 0.5f));
                }
            }

            int faceCenter = vertices.Count;
            vertices.Add(new Vector3(0, 0, halfDepth));
            uvs.Add(new Vector2(0.5f, 0.5f));
            int backCenter = vertices.Count;
            vertices.Add(new Vector3(0, 0, -halfDepth));
            uvs.Add(new Vector2(0.5f, 0.5f));

            var triangles = new List<int>(n * 12);
            for (int i = 0; i < n; i++)
            {
                int next = (i + 1) % n;
                // Front (+Z): CCW; Back (-Z): CW.
                triangles.Add(faceCenter); triangles.Add(i); triangles.Add(next);
                triangles.Add(backCenter); triangles.Add(n + next); triangles.Add(n + i);
                // Outer extrusion wall. No projection-dependent stretch.
                triangles.Add(i); triangles.Add(n + i); triangles.Add(next);
                triangles.Add(next); triangles.Add(n + i); triangles.Add(n + next);
            }

            var mesh = new Mesh { name = "GuardCover_" + identity };
            mesh.SetVertices(vertices);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(triangles, 0);
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }
    }
}
