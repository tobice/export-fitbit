# Export TCX GPS files from Fitbit

How to use:

1. Install `node` and run `npm install`.
2. Use Google Takeout to export your Fitbit data. When you download your Fitbit data from Takeout, it should
   contain `Global Export Data` folder with a bunch of JSON files. The script needs to be pointed to this folder. You
   can also manually copy `exercise*.json` files to a standalone folder and point the script there.
3. Find your auth bearer token. You can go to [Fitbit Dashboard](https://www.fitbit.com/dashboard), pick a random
   activity and download the TCX file while inspecting the request with developer tools. The bearer token is in the
   request headers.
4. Create a `config.js` file and populate it:
   ```javascript
   export const TAKEOUT_EXERCISES_DIR = "<path-to-unziped-fitbit-data>/Global Export Data";
   export const ACTIVITIES_DOWNLOAD_DIR = "./activities";
   export const FITBIT_BEARER_TOKEN = "..."
   ```
5. Start the export with `npm run start`.
