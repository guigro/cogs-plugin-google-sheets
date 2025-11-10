import {
  useCogsConfig,
  useCogsConnection,
  useCogsEvent,
  useIsConnected,
} from "@clockworkdog/cogs-client-react";
import { useCallback, useMemo } from "react";
import "./App.css";
import useGoogleApi from "./googleApi";
import parseRow from "./parseRow";

const GOOGLE_API_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const GOOGLE_API_DISCOVERY_DOCS = [
  "https://sheets.googleapis.com/$discovery/rest?version=v4",
];

export default function App() {
  const connection = useCogsConnection<{
    config: {
      "Service Account JSON": string;
      "Spreadsheet ID": string;
      "Tab Name": string;
    };
    inputEvents: {
      "Append Row": string;
      "Add to existing Row": string;
    };
  }>();
  const isConnected = useIsConnected(connection);
  const {
    "Service Account JSON": serviceAccountJson,
    "Spreadsheet ID": spreadsheetId,
    "Tab Name": tabName,
  } = useCogsConfig(connection);

  const serviceAccount = useMemo(
    () => {
      try {
        return (serviceAccountJson ? JSON.parse(serviceAccountJson) : undefined)
      } catch (error) {
        console.warn(`Could not parse Service Account JSON: "${serviceAccountJson}"`, error)
        return undefined;
      }
    },
    [serviceAccountJson]
  );

  const googleApi = useGoogleApi({
    discoveryDocs: GOOGLE_API_DISCOVERY_DOCS,
    scopes: GOOGLE_API_SCOPES,
    serviceAccount,
  });

  const appendRow = useCallback(
    (rowString: string) => {
      const row = parseRow(rowString);

      console.log(row);

      if (!googleApi) {
        console.warn("Google API not loaded yet");
        return;
      }

      googleApi.client.sheets.spreadsheets.values
        .append({
          spreadsheetId: spreadsheetId,
          range: `${tabName}!A1:E`,
          resource: {
            values: [row],
          },
          valueInputOption: "USER_ENTERED",
        })
        .then((response) => {
          console.log(
            `${response.result.updates?.updatedCells} cells appended.`
          );
        });
    },
    [spreadsheetId, tabName, googleApi]
  );

  const appendToRow = useCallback(
    async (rowString: string) => {
      const row = parseRow(rowString);

      if (row.length === 0) {
        console.warn("Empty row provided");
        return;
      }

      const key = row[0];
      const valuesToAppend = row.slice(1); // Remove the key, keep only values to append
      console.log("Append to row with key:", key, "values:", valuesToAppend);

      if (!googleApi) {
        console.warn("Google API not loaded yet");
        return;
      }

      try {
        // Read all data to find the key and determine where to append
        const response = await googleApi.client.sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: `${tabName}!A:ZZ`, // Read all columns
        });

        const values = response.result.values || [];

        // Find the row index where the key matches (0-indexed in array)
        const rowIndex = values.findIndex((rowData) => rowData[0] === key);

        if (rowIndex !== -1) {
          // Key found - append values at the end of the row
          const rowNumber = rowIndex + 1; // Convert to 1-indexed for Sheets API
          const existingRow = values[rowIndex];
          const lastColumnIndex = existingRow.length; // Next empty column
          const startColumn = String.fromCharCode(65 + lastColumnIndex); // Convert to letter (A=65)

          const appendResponse = await googleApi.client.sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!${startColumn}${rowNumber}`,
            resource: {
              values: [valuesToAppend],
            },
            valueInputOption: "USER_ENTERED",
            insertDataOption: "OVERWRITE",
          });
          console.log(
            `${appendResponse.result.updates?.updatedCells} cells appended to row ${rowNumber}.`
          );
        } else {
          // Key not found - create new row with key + values
          const appendResponse = await googleApi.client.sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!A1`,
            resource: {
              values: [row], // Include key + values
            },
            valueInputOption: "USER_ENTERED",
          });
          console.log(
            `Key not found. ${appendResponse.result.updates?.updatedCells} cells appended as new row.`
          );
        }
      } catch (error) {
        console.error("Error appending to row:", error);
      }
    },
    [spreadsheetId, tabName, googleApi]
  );

  useCogsEvent(connection, "Append Row", appendRow);
  useCogsEvent(connection, "Add to existing Row", appendToRow);

  return (
    <div className="App">
      <div>{!isConnected && "Not connected"}</div>
      <div>{isConnected && !googleApi && "Loading..."}</div>
    </div>
  );
}
