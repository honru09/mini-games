# Network Shaping Guide for Real Device QA

This guide provides exact commands and tools for network shaping during the `GATE-DEVICE-BROWSER-NETWORK` phase.

## Windows (Clumsy tool / NetLimiter)

**Clumsy (Recommended for zero-install):**
1. Download [Clumsy](https://jagt.github.io/clumsy/).
2. Run `clumsy.exe` as Administrator.
3. Filtering: Set `tcp.DstPort == 80 or tcp.DstPort == 443 or tcp.DstPort == 3000` (or the specific ports used).
4. Set Lag (Delay):
   - Check `Lag` -> Set `Inbound` and `Outbound` to 50ms, 100ms, or 200ms.
5. Set Drop (Packet Loss):
   - Check `Drop` -> Set chance to 1% - 5% for testing jitter and drops.
6. Click **Start**.

## macOS (tc / Network Link Conditioner)

**Network Link Conditioner:**
1. Install "Additional Tools for Xcode" from Apple Developer.
2. Open `Hardware` -> `Network Link Conditioner.prefPane`.
3. Create Custom Profiles:
   - **50ms**: Downlink/Uplink delay 50ms.
   - **100ms**: Downlink/Uplink delay 100ms, 1% packet loss.
   - **200ms**: Downlink/Uplink delay 200ms, 3% packet loss.
4. Enable the tool.

## Chrome DevTools Throttling Profiles

1. Open Chrome DevTools (`F12`).
2. Go to the **Network** tab.
3. Click the throttling dropdown (usually says "No throttling").
4. Select **Add...** -> **Add custom profile...**
5. Create profiles:
   - Profile Name: `QA 50ms`, Download/Upload: Leave blank, Latency: `50`
   - Profile Name: `QA 100ms`, Download/Upload: Leave blank, Latency: `100`
   - Profile Name: `QA 200ms`, Download/Upload: Leave blank, Latency: `200`
6. *Note:* DevTools throttling does not easily support packet loss; use system-level tools (like Clumsy or Network Link Conditioner) for true packet drop and jitter testing.

## Verification

To verify the shaping is working:
1. Ping the server: `ping your-server-address` (e.g., localhost or production).
2. Check the time response. If shaping 100ms, the ping time should increase by ~100ms.
3. Open the game's WebSocket inspector or network tab to verify connection latency matches the expected delay.
