using System;
using UnityEngine;

namespace B737Classic.GuardedSwitches
{
    /// <summary>
    /// A cover changes ONLY the rotation of its fixed hinge pivot.
    /// Neither mesh, material, color, shape, nor local scale depends on pose.
    /// </summary>
    public sealed class GuardSwitchView : MonoBehaviour
    {
        public string ControlId { get; private set; }
        public GuardHinge Direction { get; private set; }
        public bool TargetIsOpen { get; private set; }

        public event Action<GuardSwitchView, bool> GuardPoseRequested;
        public event Action<GuardSwitchView> UnderlyingSwitchRequested;

        private Transform _pivot;
        private Transform _cover;
        private MeshFilter _filter;
        private MeshRenderer _renderer;
        private Mesh _lockedMesh;
        private Material _lockedMaterial;
        private Color _lockedColor;
        private Vector3 _lockedScale;
        private Quaternion _closedPose;
        private Quaternion _openPose;
        private float _duration;
        private float _progress;
        private bool _initialized;

        public static Vector3 LocalPivot(float width, float height, GuardHinge direction)
        {
            switch (direction)
            {
                case GuardHinge.Up: return new Vector3(0f, height * 0.5f, 0f);
                case GuardHinge.Down: return new Vector3(0f, -height * 0.5f, 0f);
                case GuardHinge.Left: return new Vector3(-width * 0.5f, 0f, 0f);
                case GuardHinge.Right: return new Vector3(width * 0.5f, 0f, 0f);
                default: throw new ArgumentOutOfRangeException(nameof(direction));
            }
        }

        public static Vector3 LocalOpeningAxis(GuardHinge direction)
        {
            // Panel plane XY, audience in +Z: every free edge swings toward +Z.
            switch (direction)
            {
                case GuardHinge.Up: return -Vector3.right;
                case GuardHinge.Down: return Vector3.right;
                case GuardHinge.Left: return -Vector3.up;
                case GuardHinge.Right: return Vector3.up;
                default: throw new ArgumentOutOfRangeException(nameof(direction));
            }
        }

        public void Initialize(
            GuardBlueprint spec, Transform pivot, Transform cover,
            MeshFilter filter, MeshRenderer renderer)
        {
            if (_initialized) throw new InvalidOperationException("Guard must be initialized once.");
            if (spec == null || pivot == null || cover == null || filter == null || renderer == null)
                throw new ArgumentNullException(nameof(spec));

            ControlId = spec.controlId;
            if (!Enum.TryParse(spec.hingeDirection, false, out GuardHinge direction))
                throw new InvalidOperationException("Missing owner-verified hinge direction.");
            Direction = direction;
            _pivot = pivot;
            _cover = cover;
            _filter = filter;
            _renderer = renderer;
            _lockedMesh = filter.sharedMesh;
            _lockedMaterial = renderer.sharedMaterial;
            _lockedScale = cover.localScale;
            if (_lockedMesh == null || _lockedMaterial == null)
                throw new InvalidOperationException("Cover needs one fixed mesh and one fixed material.");
            _lockedColor = _lockedMaterial.color;

            _closedPose = pivot.localRotation;
            _openPose = _closedPose * Quaternion.AngleAxis(
                Mathf.Clamp(spec.motion.openAngleDegrees, 1f, 179f),
                LocalOpeningAxis(direction));
            _duration = Mathf.Max(0.05f, spec.motion.durationSeconds);
            _initialized = true;
            SetOpen(false, true);
        }

        public bool InvariantsHold()
        {
            return _initialized && _filter != null && _renderer != null &&
                   _filter.sharedMesh == _lockedMesh &&
                   _renderer.sharedMaterial == _lockedMaterial &&
                   _lockedMaterial.color == _lockedColor &&
                   _cover.localScale == _lockedScale;
        }

        public void SetOpen(bool open, bool instant = false)
        {
            if (!_initialized) throw new InvalidOperationException("Guard not initialized.");
            if (!InvariantsHold()) throw new InvalidOperationException("Guard cover identity changed.");
            bool changed = TargetIsOpen != open;
            TargetIsOpen = open;
            if (instant)
            {
                _progress = open ? 1f : 0f;
                ApplyPose();
            }
            if (changed) GuardPoseRequested?.Invoke(this, open);
        }

        public void ToggleOpen()
        {
            SetOpen(!TargetIsOpen);
        }

        public bool TryRequestUnderlyingSwitch()
        {
            if (!_initialized || _progress < 0.999f || !TargetIsOpen) return false;
            UnderlyingSwitchRequested?.Invoke(this);
            return true;
        }

        private void Update()
        {
            if (!_initialized || _pivot == null) return;
            float target = TargetIsOpen ? 1f : 0f;
            _progress = Mathf.MoveTowards(_progress, target, Time.deltaTime / _duration);
            ApplyPose();
#if UNITY_EDITOR || DEVELOPMENT_BUILD
            if (!InvariantsHold()) Debug.LogError("Guard geometry/material drift: " + ControlId, this);
#endif
        }

        private void ApplyPose()
        {
            float eased = Mathf.SmoothStep(0f, 1f, _progress);
            _pivot.localRotation = Quaternion.SlerpUnclamped(_closedPose, _openPose, eased);
            // No other transform, mesh or material state is written here.
        }
    }

    public sealed class GuardPreviewClickTarget : MonoBehaviour
    {
        public GuardSwitchView target;
        public bool underlyingSwitch;
        private void OnMouseDown()
        {
            if (target == null) return;
            if (underlyingSwitch) target.TryRequestUnderlyingSwitch();
            else target.ToggleOpen();
        }
    }
}
