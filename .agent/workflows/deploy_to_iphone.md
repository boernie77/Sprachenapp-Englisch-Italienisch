---
description: Deploying to Physical iOS Device
---
# How to Deploy your App to your iPhone

1. **Synchronize Code**:
   Run the following command to make sure your latest web changes are in the iOS project:
   ```bash
   npx cap sync ios
   ```

2. **Open Xcode**:
   Open your native iOS project:
   ```bash
   npx cap open ios
   ```

3. **Configure Signing**:
   In Xcode (left sidebar):
   - Click on the blue **App** project icon at the very top.
   - Select the **App** target in the inner list.
   - Go to the **Signing & Capabilities** tab.
   - Click **Add Account...** (if not already there) and sign in with your Apple ID.
   - Select your **Team** (e.g., "Christian Bernauer (Personal Team)").
   - Xcode might ask for a "Bundle Identifier" change if your choice is taken; you can add a suffix like `.mobile`.

4. **Select your iPhone**:
   - In the top bar of Xcode, click on the current device (e.g., "iPhone 15 Pro Max Simulator").
   - Scroll up and select your **connected physical iPhone**.

5. **Build and Run**:
   - Press the **Play (▷)** button in the top left or `Cmd + R`.

6. **Trust the App on iPhone**:
   The first time, you will see an "Untrusted Developer" error on your phone.
   - Go to **Settings** > **General**.
   - Scroll down to **VPN & Device Management**.
   - Tap on your Apple ID/Developer Profile.
   - Tap **Trust "Your Name/Apple ID"**.

7. **Launch the App**:
   - Tap the app icon on your home screen!
