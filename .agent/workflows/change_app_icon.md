---
description: Changing the App Icon
---
# How to Change your App Icon

Since your app is built with Capacitor, you have two options:

## Option A: Easy Way (via Xcode)
This is best if you just have the icon ready.

1.  **Prepare your Icon**: Create a square PNG image (ideally 1024x1024 pixels).
2.  **Open Xcode**: Run `npx cap open ios` in the terminal.
3.  **Navigate to Assets**: 
    - In the left sidebar, open the **App** folder > **App** folder > **Assets**.
    - Click on **AppIcon**.
4.  **Drag and Drop**: 
    - Simply drag your PNG image into the different slots (e.g., 20pt, 29pt, 40pt, 60pt). 
    - *Tip*: You can use a website like [App Icon Generator](https://appicon.co/) to generate a folder with all these sizes automatically.

## Option B: Professional Way (Automatic Generation)
This is best if you want to use the Capacitor command line.

1.  **Install the Tool**:
    ```bash
    npm install @capacitor/assets --save-dev
    ```
2.  **Provide a Source Image**: 
    Create a folder named `assets` in your project root and place a file named `icon-only.png` or `icon.png` inside it (must be 1024x1024).
3.  **Run the Generator**:
    ```bash
    npx capacitor-assets generate --ios
    ```
4.  **Sync**:
    ```bash
    npx cap sync ios
    ```

After these steps, the new icon will be used the next time you build and run the app from Xcode! 🎨📱
