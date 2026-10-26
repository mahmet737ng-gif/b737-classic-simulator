using System;
using System.Collections.Generic;
using UnityEngine;

namespace B737Classic.GuardedSwitches
{
    /// <summary>
    /// PREVIEW-ONLY actuator detents (not aircraft system logic). Toggling a
    /// guarded switch never changes mesh, material, color, geometry or scale.
    /// Gen drive disconnect is treated as spring-return ACTUATE, not a stable
    /// two-position lever. It cannot reconnect a disconnected drive.
    /// </summary>
    public sealed class GuardActuatorView : MonoBehaviour
    {
        [SerializeField] private GuardActuatorAppearance appearance;
        [SerializeField] private GuardSwitchView guard;
        [SerializeField] private Transform shaftPivot;
        [SerializeField] private Transform grip;
        [SerializeField] private string stateLabel;

        public string StateLabel { get { return stateLabel; } }
        public bool IsMomentary { get { return appearance != null && appearance.momentary; } }
        public string[] DetentLabels { get { return appearance?.detentLabels; } }

        private Quaternion basePose;
        private Quaternion wantedPose;
        private bool ready;
        private bool subscribed;
        private float releaseClock;
        private int selectedIndex;
        private readonly Dictionary<MeshFilter, Mesh> meshLock=new Dictionary<MeshFilter, Mesh>();
        private readonly Dictionary<MeshRenderer, Material> materialLock=new Dictionary<MeshRenderer, Material>();
        private readonly Dictionary<MeshRenderer, Color> colorLock=new Dictionary<MeshRenderer, Color>();
        private readonly Dictionary<Transform, Vector3> scaleLock=new Dictionary<Transform, Vector3>();

        private void Awake()
        {
            if (!ready && appearance != null && guard != null && shaftPivot != null && grip != null)
                Initialize(appearance,shaftPivot,guard,grip);
        }

        public void Initialize(GuardActuatorAppearance spec, Transform pivot, GuardSwitchView owner, Transform tip)
        {
            if (ready) throw new InvalidOperationException("Actuator already initialized");
            if (spec == null || pivot == null || owner == null || tip == null ||
                spec.detentLabels == null || spec.detentLabels.Length < 2)
                throw new ArgumentNullException(nameof(spec));

            appearance=spec;guard=owner;shaftPivot=pivot;grip=tip;
            basePose=pivot.localRotation;
            int start=Array.IndexOf(spec.detentLabels,spec.initialState);
            if (start < 0) throw new InvalidOperationException("FCOM state not in guarded switch detents");
            foreach(MeshFilter filter in GetComponentsInChildren<MeshFilter>(true))
                meshLock.Add(filter,filter.sharedMesh);
            foreach(MeshRenderer renderer in GetComponentsInChildren<MeshRenderer>(true))
            {
                Material mat=renderer.sharedMaterial;
                if(mat == null) throw new InvalidOperationException("Incomplete switch material");
                materialLock.Add(renderer,mat);
                colorLock.Add(renderer,mat.color);
            }
            foreach(Transform transform in GetComponentsInChildren<Transform>(true))
                scaleLock.Add(transform,transform.localScale);
            ready=true;
            SetIndex(start,true);
            Subscribe();
        }

        private void Subscribe()
        {
            if(!subscribed && guard!=null)
            {
                guard.UnderlyingSwitchRequested+=OnOwnerRequest;
                subscribed=true;
            }
        }

        private void OnEnable() { if(ready) Subscribe(); }
        private void OnDisable()
        {
            if(subscribed && guard!=null) guard.UnderlyingSwitchRequested-=OnOwnerRequest;
            subscribed=false;
        }
        private void OnOwnerRequest(GuardSwitchView source)
        {
            if(source==guard) CyclePreview();
        }

        public bool CyclePreview()
        {
            if(!ready || guard==null || !guard.TargetIsOpen) return false;
            if(appearance.momentary)
            {
                SetIndex(1,false);
                releaseClock=.30f;
                return true;
            }
            SetIndex((selectedIndex+1)%appearance.detentLabels.Length,false);
            return true;
        }

        public void SetIndex(int index, bool instant)
        {
            if(!ready) throw new InvalidOperationException("Actuator not initialized");
            if(index<0 || index>=appearance.detentLabels.Length)
                throw new ArgumentOutOfRangeException(nameof(index));
            if(!InvariantsHold()) throw new InvalidOperationException("Underlying switch appearance drift");
            selectedIndex=index;
            stateLabel=appearance.detentLabels[index];
            float degree=appearance.momentary
                ? (index==0?0f:appearance.detentTiltDegrees)
                : (appearance.detentLabels.Length==2
                    ? (index==0?-appearance.detentTiltDegrees:appearance.detentTiltDegrees)
                    : (index-1)*appearance.detentTiltDegrees);
            Vector3 axis=appearance.detentAxis=="horizontal"?Vector3.up:Vector3.right;
            wantedPose=basePose*Quaternion.AngleAxis(degree,axis);
            if(instant) shaftPivot.localRotation=wantedPose;
        }

        private void Update()
        {
            if(!ready) return;
            if(releaseClock>0f)
            {
                releaseClock-=Time.deltaTime;
                if(releaseClock<=0f && appearance.momentary) SetIndex(0,false);
            }
            shaftPivot.localRotation=Quaternion.RotateTowards(
                shaftPivot.localRotation,wantedPose,Time.deltaTime*460f);
#if UNITY_EDITOR || DEVELOPMENT_BUILD
            if(!InvariantsHold())
                Debug.LogError("Guarded switch geometry or material drift at "+gameObject.name,this);
#endif
        }

        public bool InvariantsHold()
        {
            if(!ready || meshLock.Count==0 || materialLock.Count==0) return false;
            foreach(var p in meshLock) if(p.Key==null || p.Key.sharedMesh!=p.Value) return false;
            foreach(var p in materialLock)
                if(p.Key==null || p.Key.sharedMaterial!=p.Value ||
                   p.Value==null || p.Value.color!=colorLock[p.Key]) return false;
            foreach(var p in scaleLock)
                if(p.Key==null || p.Key.localScale!=p.Value) return false;
            return true;
        }
    }
}
