# Export TCX GPS files from Fitbit

How to use:

1. Install `node` and run `npm install`.
2. Find your Fitbit auth bearer token. You can go to [Fitbit Dashboard](https://www.fitbit.com/dashboard), open
   developer tools, examine any request going to Fitbit API, and find the bearer token in request headers.
3. Create a `config.js` file and populate it:
   ```javascript
   export const AFTER_DATE = "2022-10-01";
   export const ACTIVITIES_DOWNLOAD_DIR = "./activities";
   export const FITBIT_BEARER_TOKEN = "..."
   ```
4. Start the export with `npm run start`. Use `APIFY_LOG_LEVEL=DEBUG` for more detailed logs.
