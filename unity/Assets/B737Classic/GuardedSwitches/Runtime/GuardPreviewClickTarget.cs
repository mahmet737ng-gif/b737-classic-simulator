using UnityEngine;

namespace B737Classic.GuardedSwitches
{
    /// <summary>Clickable physical face: opening the guard and operating
    /// its underlying actuator are independent actions.</summary>
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
