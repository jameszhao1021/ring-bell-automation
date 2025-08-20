import { PushNotificationAction, RingApi } from "ring-client-api";
import { readFile, writeFile } from "fs";
import { promisify } from "util";
import axios from "axios";
import dotenv from "dotenv";
import AWS from "aws-sdk";
import { distinctUntilChanged } from 'rxjs/operators'

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

async function example() {

 const n8nWebhookUrl:string = "https://ampeddigital.app.n8n.cloud/webhook/54ab2a8e-8b36-49f7-9c81-6af6f873f043";




  const { env } = process,
    // ringApi = new RingApi({
    //   refreshToken: env.RING_REFRESH_TOKEN!,
    //   debug: true,
    // }),

    //test

    ringApi = new RingApi({
  refreshToken: process.env.RING_REFRESH_TOKEN!,
  systemId: 'amped-n8n-bridge',   // any stable string
  debug: true,
  // temporary fallback polling (see #4)
  cameraStatusPollingSeconds: 20,
}),
    locations = await ringApi.getLocations(),
    allCameras = await ringApi.getCameras();

  console.log(
    `Found ${locations.length} location(s) with ${allCameras.length} camera(s).`
  );


  
  ringApi.onRefreshTokenUpdated.subscribe(
    async ({ newRefreshToken, oldRefreshToken }) => {
      console.log("Refresh Token Updated: ", newRefreshToken);
      if (!oldRefreshToken) return;
      const currentConfig = await promisify(readFile)(".env"),
        updatedConfig = currentConfig
          .toString()
          .replace(oldRefreshToken, newRefreshToken);

      await promisify(writeFile)(".env", updatedConfig);
    }
  );

    for (const location of locations) {
      //original correct one
    // let haveConnected = false;

    // console.log(`location ${location.name} - ${location.id}`);

    // location.onConnected.subscribe((connected) => {
    //   if (!haveConnected && !connected) {
    //     return;
    //   } else if (connected) {
    //     haveConnected = true;
    //   }

    //   const status = connected ? "Connected to" : "Disconnected from";
    //   console.log(`**** ${status} location ${location.name} - ${location.id}`);
    // });


  


  // console.log(`Registering connection listener for: "${location.name}" (${location.id})`);

  // location.onConnected.subscribe((connected: boolean) => {
  //   const status = connected ? "✅ Connected to" : "❌ Disconnected from";
  //   console.log(`${status} location "${location.name}" (${location.id})`);
  // });

  // // Optional: also log once right away (best-effort snapshot)
  // // Some versions may expose a property/state; if not, this at least confirms we subscribed.
  // console.log(`Listener registered for "${location.name}" (${location.id})`);

//test
location.onConnected
    .pipe(distinctUntilChanged())
    .subscribe((connected) => {
      const status = connected ? 'Connected to' : 'Disconnected from'
      console.log(`**** ${status} location ${location.name} - ${location.id}`)
    })
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
        `${event} on ${camera.name} camera. Ding id ${notification.data.event.ding.id}. Received at ${new Date()}`
      );

      if (action === PushNotificationAction.Ding) {
        try {

      

          const imageBuffer = await camera.getSnapshot();

          const s3Upload = await s3
            .upload({
              Bucket: env.AWS_S3_BUCKET_NAME!,
              Key: camera.name == "Front Door"?"latest-snapshot-front-door.jpg":camera.name == "Back Door"?"latest-snapshot-back-door.jpg":"latest-snapshot.jpg",
              Body: imageBuffer,
              ContentType: "image/jpeg",
              ACL: "public-read",
            })
            .promise();

           const imageUrl = s3Upload.Location;
          console.log("✅ Snapshot uploaded to:", imageUrl);

          await axios.post(n8nWebhookUrl, {
            event: "doorbell_pressed",
            camera: camera.name,
            timestamp: new Date().toISOString(),
            // snapshot_url: imageUrl,
          });

          console.log("✅ Webhook sent to n8n");
        } catch (err: any) {
          console.error("❌ Failed to upload/send snapshot:", err.message);
        }
      }
    });

    console.log("Listening for motion and doorbell presses on your cameras.");
  }
}

example();