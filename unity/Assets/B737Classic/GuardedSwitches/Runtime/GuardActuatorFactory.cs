using System;
using UnityEngine;

namespace B737Classic.GuardedSwitches
{
    /// <summary>
    /// Creates a complete UNDERLYING switch instead of the old generic capsule:
    /// a recessed dark socket, concentric metal collar, tapered shaft and
    /// per-control grip. Provisional proportions are NOT measured B737 hardware.
    /// Every position shares exactly the same geometry and materials; only the
    /// shaft pivot rotation changes.
    /// </summary>
    public static class GuardActuatorFactory
    {
        public static GuardActuatorView CreatePreview(
            GuardBlueprint blueprint, Transform parent, GuardSwitchView guardedCover)
        {
            if (blueprint == null || blueprint.switchAppearance == null || parent == null || guardedCover == null)
                throw new ArgumentNullException(nameof(blueprint));

            GuardActuatorAppearance a = blueprint.switchAppearance;
            float shortest = Mathf.Min(blueprint.geometry.previewWidth, blueprint.geometry.previewHeight);
            float shaftLen = Mathf.Max(0.012f, shortest * a.shaftRelativeScale * a.shaftLengthScale);
            float gripLen = Mathf.Max(0.009f, shortest * a.gripRelativeScale);
            float stemDiameter = Mathf.Max(0.003f, Mathf.Min(0.010f, shortest * 0.090f));
            bool flatTip = a.family == "wide-micro-toggle" || a.family == "slim-three-position";
            bool miniTip = a.family == "gpws-mini-identical" || a.family == "mini-silver-test";
            bool push = a.momentary || a.actuatorType == "metal-plunger";
            if (miniTip) stemDiameter *= 0.82f;
            if (push) shaftLen *= 0.72f;

            GameObject chassis = new GameObject("UnderlyingSwitch_" + blueprint.controlId);
            chassis.transform.SetParent(parent, false);
            chassis.transform.localPosition = Vector3.zero;
            chassis.transform.localScale = Vector3.one;

            Material socket = MakeMaterial("Socket_" + blueprint.controlId, a.faceHex, 0.08f, 0.8f);
            Material ring = MakeMaterial("BezelMetal_" + blueprint.controlId, a.ringHex, 0.72f, 0.32f);
            Material shaftMetal = MakeMaterial("ShaftMetal_" + blueprint.controlId,
                a.shaftHex, a.shaftMetallic, a.shaftRoughness);
            Material cap = MakeMaterial("Grip_" + blueprint.controlId,
                a.gripHex, a.gripMetallic, a.gripRoughness);

            float radius = Mathf.Max(.006f, Mathf.Min(shortest * .175f, .018f));
            MakeCylinder("MountRing_Fixed", chassis.transform, ring,
                new Vector3(0,0,.003f), radius * 2.0f, .0038f);
            MakeCylinder("DarkRecess_Fixed", chassis.transform, socket,
                new Vector3(0,0,.006f), radius * 1.35f, .0017f);
            MakeCylinder("ShaftBearing_Fixed", chassis.transform, shaftMetal,
                new Vector3(0,0,.008f), radius * .84f, .0035f);

            GameObject shaftPivot = new GameObject("SwitchShaftPivot_DetentsOnly");
            shaftPivot.transform.SetParent(chassis.transform, false);
            shaftPivot.transform.localPosition = new Vector3(0,0,.010f);
            shaftPivot.transform.localScale = Vector3.one;

            // A taper is represented by a metal shaft and a short pivot collar.
            // The shaft material is authored ONCE, never switched on interaction.
            MakeCylinder("TaperedSatinShaft", shaftPivot.transform, shaftMetal,
                new Vector3(0,0,shaftLen*.51f), stemDiameter, shaftLen);
            MakeCylinder("LowerShoulderRing", shaftPivot.transform, ring,
                new Vector3(0,0,.0028f), stemDiameter*1.65f, .0045f);

            GameObject grip;
            float tipWidth=stemDiameter*(flatTip?2.3f:push?2.0f:miniTip?1.45f:1.8f);
            if (flatTip)
            {
                grip = GameObject.CreatePrimitive(PrimitiveType.Cube);
                grip.name="FlatKnurledSelectorCap";
                grip.transform.SetParent(shaftPivot.transform,false);
                grip.transform.localPosition=new Vector3(0,0,shaftLen+gripLen*.35f);
                grip.transform.localScale=new Vector3(tipWidth*1.6f,gripLen*.65f,tipWidth);
            }
            else if (push)
            {
                grip=GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                grip.name="MomentaryPullReleaseButton";
                grip.transform.SetParent(shaftPivot.transform,false);
                grip.transform.localPosition=new Vector3(0,0,shaftLen+gripLen*.15f);
                grip.transform.localRotation=Quaternion.Euler(90f,0f,0f);
                grip.transform.localScale=new Vector3(tipWidth,gripLen*.23f,tipWidth);
            }
            else
            {
                grip=GameObject.CreatePrimitive(PrimitiveType.Capsule);
                grip.name=miniTip?"MiniMetalGrip":"ContouredGuardedToggleGrip";
                grip.transform.SetParent(shaftPivot.transform,false);
                grip.transform.localPosition=new Vector3(0,0,shaftLen+gripLen*.40f);
                grip.transform.localRotation=Quaternion.Euler(90f,0f,0f);
                grip.transform.localScale=new Vector3(tipWidth,gripLen*.31f,tipWidth);
            }
            grip.GetComponent<MeshRenderer>().sharedMaterial=cap;

            // Brushed stainless steel detail under the grip, physically attached
            // to the same switch-shaft hierarchy.
            MakeCylinder("GripFerrule", shaftPivot.transform, ring,
                new Vector3(0,0,shaftLen*.97f), stemDiameter*1.27f, .0032f);

            GuardActuatorView view=chassis.AddComponent<GuardActuatorView>();
            view.Initialize(a, shaftPivot.transform, guardedCover, grip.transform);
            GuardPreviewClickTarget input=grip.AddComponent<GuardPreviewClickTarget>();
            input.target=guardedCover;
            input.underlyingSwitch=true;
            if (!view.InvariantsHold()) throw new InvalidOperationException(
                "Guarded switch visual identity failed: "+blueprint.controlId);
            return view;
        }

        private static GameObject MakeCylinder(
            string name, Transform parent, Material material, Vector3 center, float diameter, float depth)
        {
            GameObject go=GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            go.name=name;
            go.transform.SetParent(parent,false);
            go.transform.localPosition=center;
            // Unity primitive cylinder length is 2 on local Y; rotate to +Z.
            go.transform.localRotation=Quaternion.Euler(90f,0f,0f);
            go.transform.localScale=new Vector3(diameter,depth*.5f,diameter);
            go.GetComponent<MeshRenderer>().sharedMaterial=material;
            return go;
        }

        private static Material MakeMaterial(string name,string hex,float metallic,float roughness)
        {
            Shader shader=Shader.Find("Universal Render Pipeline/Lit");
            if (shader==null) shader=Shader.Find("Standard");
            if (shader==null) shader=Shader.Find("Sprites/Default");
            if (shader==null) throw new InvalidOperationException("No material shader available.");
            Color color;
            if (!ColorUtility.TryParseHtmlString(hex,out color))
                throw new InvalidOperationException("Invalid hardware surface swatch: "+hex);
            Material material=new Material(shader);
            material.name=name;
            material.color=color;
            if(material.HasProperty("_Metallic")) material.SetFloat("_Metallic",Mathf.Clamp01(metallic));
            if(material.HasProperty("_Smoothness")) material.SetFloat("_Smoothness",1f-Mathf.Clamp01(roughness));
            else if(material.HasProperty("_Glossiness")) material.SetFloat("_Glossiness",1f-Mathf.Clamp01(roughness));
            return material;
        }
    }
}
