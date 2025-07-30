import { PushNotificationAction, RingApi } from "ring-client-api";
import { readFile, writeFile } from "fs";
import { promisify } from "util";
import axios from "axios";
import dotenv from 'dotenv';
dotenv.config();

async function example() {
  const n8nWebhookUrl:string = "https://ampeddigital.app.n8n.cloud/webhook/54ab2a8e-8b36-49f7-9c81-6af6f873f043"
  const { env } = process,
    ringApi = new RingApi({
      // This value comes from the .env file
      refreshToken: env.RING_REFRESH_TOKEN!,
      debug: true,
    }),
    locations = await ringApi.getLocations(),
    allCameras = await ringApi.getCameras();

  console.log(
    `Found ${locations.length} location(s) with ${allCameras.length} camera(s).`
  );

  ringApi.onRefreshTokenUpdated.subscribe(
    async ({ newRefreshToken, oldRefreshToken }) => {
      console.log("Refresh Token Updated: ", newRefreshToken);

      // If you are implementing a project that use `ring-client-api`, you should subscribe to onRefreshTokenUpdated and update your config each time it fires an event
      if (!oldRefreshToken) {
        return;
      }

      const currentConfig = await promisify(readFile)(".env"),
        updatedConfig = currentConfig
          .toString()
          .replace(oldRefreshToken, newRefreshToken);

      await promisify(writeFile)(".env", updatedConfig);
    }
  );

  for (const location of locations) {
    let haveConnected = false;
    location.onConnected.subscribe((connected) => {
      if (!haveConnected && !connected) {
        return;
      } else if (connected) {
        haveConnected = true;
      }

      const status = connected ? "Connected to" : "Disconnected from";
      console.log(`**** ${status} location ${location.name} - ${location.id}`);
    });
  }

  for (const camera of allCameras) {
  camera.onNewNotification.subscribe(async (notification) => {
    const action = notification.android_config.category;
    const event =
      action === PushNotificationAction.Motion
        ? "Motion detected"
        : action === PushNotificationAction.Ding
        ? "Doorbell pressed"
        : `Video started (${action})`;

    console.log(
      `${event} on ${camera.name} camera. Ding id ${
        notification.data.event.ding.id
      }.  Received at ${new Date()}`
    );

    if (action === PushNotificationAction.Ding) {
      try {
        await axios.post(n8nWebhookUrl, {
          event: "doorbell_pressed",
          camera: camera.name,
          timestamp: new Date().toISOString(),
        });
        console.log("✅ Webhook sent to n8n");
      } catch (err:any) {
        console.error("❌ Failed to send webhook:", err.message);
      }
    }
  });


    console.log("Listening for motion and doorbell presses on your cameras.");
  }
}

example();

// import { PushNotificationAction, RingApi } from "ring-client-api";
// import { readFile, writeFile } from "fs";
// import { promisify } from "util";

// async function example() {
//   const { env } = process,
//     ringApi = new RingApi({
//       // This value comes from the .env file
//       refreshToken: env.RING_REFRESH_TOKEN!,
//       debug: true,
//     }),
//     locations = await ringApi.getLocations(),
//     allCameras = await ringApi.getCameras();

//   console.log(
//     `Found ${locations.length} location(s) with ${allCameras.length} camera(s).`
//   );

//   ringApi.onRefreshTokenUpdated.subscribe(
//     async ({ newRefreshToken, oldRefreshToken }) => {
//       console.log("Refresh Token Updated: ", newRefreshToken);

//       // If you are implementing a project that use `ring-client-api`, you should subscribe to onRefreshTokenUpdated and update your config each time it fires an event
//       // Here is an example using a .env file for configuration
//       if (!oldRefreshToken) {
//         return;
//       }

//       const currentConfig = await promisify(readFile)(".env"),
//         updatedConfig = currentConfig
//           .toString()
//           .replace(oldRefreshToken, newRefreshToken);

//       await promisify(writeFile)(".env", updatedConfig);
//     }
//   );

//   for (const location of locations) {
//     let haveConnected = false;
//     location.onConnected.subscribe((connected) => {
//       if (!haveConnected && !connected) {
//         return;
//       } else if (connected) {
//         haveConnected = true;
//       }

//       const status = connected ? "Connected to" : "Disconnected from";
//       console.log(`**** ${status} location ${location.name} - ${location.id}`);
//     });
//   }

//   for (const location of locations) {
//     const cameras = location.cameras,
//       devices = await location.getDevices();

//     console.log(
//       `\nLocation ${location.name} (${location.id}) has the following ${cameras.length} camera(s):`
//     );

//     for (const camera of cameras) {
//       console.log(`- ${camera.id}: ${camera.name} (${camera.deviceType})`);
//     }

//     console.log(
//       `\nLocation ${location.name} (${location.id}) has the following ${devices.length} device(s):`
//     );

//     for (const device of devices) {
//       console.log(`- ${device.zid}: ${device.name} (${device.deviceType})`);
//     }
//   }

//   if (allCameras.length) {
//     allCameras.forEach((camera) => {
//       camera.onNewNotification.subscribe((notification) => {
//         const action = notification.android_config.category,
//           event =
//             action === PushNotificationAction.Motion
//               ? "Motion detected"
//               : action === PushNotificationAction.Ding
//               ? "Doorbell pressed"
//               : `Video started (${action})`;

//         console.log(
//           `${event} on ${camera.name} camera. Ding id ${
//             notification.data.event.ding.id
//           }.  Received at ${new Date()}`
//         );
//       });
//     });

//     console.log("Listening for motion and doorbell presses on your cameras.");
//   }
// }

// example();