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

function columnIndexToLetter(index: number): string {
  let column = '';
  while (index >= 0) {
    column = String.fromCharCode((index % 26) + 65) + column;
    index = Math.floor(index / 26) - 1;
  }
  return column;
}

function letterToColumnIndex(letters: string): number {
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.toUpperCase().charCodeAt(i) - 64);
  }
  return index - 1;
}

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
      "Add to existing Row with column": string;
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
        // First, read only column A to find the key (more efficient)
        const keyColumnResponse = await googleApi.client.sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: `${tabName}!A:A`, // Read only first column
        });

        const keyColumn = keyColumnResponse.result.values || [];

        // Find the row index where the key matches (0-indexed in array)
        const rowIndex = keyColumn.findIndex((rowData) => rowData[0] === key);

        if (rowIndex !== -1) {
          // Key found - now fetch only that specific row to determine where to append
          const rowNumber = rowIndex + 1; // Convert to 1-indexed for Sheets API

          const rowResponse = await googleApi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!${rowNumber}:${rowNumber}`, // Read only the specific row
          });

          const existingRow = rowResponse.result.values?.[0] || [];
          const lastColumnIndex = existingRow.length; // Next empty column
          const startColumn = columnIndexToLetter(lastColumnIndex);

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

  const appendToRowWithColumn = useCallback(
    async (rowString: string) => {
      const row = parseRow(rowString);

      if (row.length < 2) {
        console.warn("Input must contain at least ID and column (e.g., 'ID,C,value1,value2')");
        return;
      }

      const key = row[0];
      const startColumnLetter = row[1];
      const valuesToWrite = row.slice(2);
      console.log("Append to row with key:", key, "starting at column:", startColumnLetter, "values:", valuesToWrite);

      if (!googleApi) {
        console.warn("Google API not loaded yet");
        return;
      }

      try {
        // First, read only column A to find the key
        const keyColumnResponse = await googleApi.client.sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: `${tabName}!A:A`,
        });

        const keyColumn = keyColumnResponse.result.values || [];
        const rowIndex = keyColumn.findIndex((rowData) => rowData[0] === key);
        const startColumnIndex = letterToColumnIndex(startColumnLetter);
        const endColumnLetter = columnIndexToLetter(startColumnIndex + valuesToWrite.length - 1);

        if (rowIndex !== -1) {
          // Key found - write values at the specified column
          const rowNumber = rowIndex + 1;

          const updateResponse = await googleApi.client.sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!${startColumnLetter.toUpperCase()}${rowNumber}:${endColumnLetter}${rowNumber}`,
            resource: {
              values: [valuesToWrite],
            },
            valueInputOption: "USER_ENTERED",
          });
          console.log(
            `${updateResponse.result.updatedCells} cells updated in row ${rowNumber}.`
          );
        } else {
          // Key not found - create new row with key in A and values at specified column
          // Build a row with key in first position and values at the right offset
          const newRow: string[] = [key];
          for (let i = 1; i < startColumnIndex; i++) {
            newRow.push('');
          }
          newRow.push(...valuesToWrite);

          const appendResponse = await googleApi.client.sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: `${tabName}!A1`,
            resource: {
              values: [newRow],
            },
            valueInputOption: "USER_ENTERED",
          });
          console.log(
            `Key not found. ${appendResponse.result.updates?.updatedCells} cells appended as new row.`
          );
        }
      } catch (error) {
        console.error("Error appending to row with column:", error);
      }
    },
    [spreadsheetId, tabName, googleApi]
  );

  useCogsEvent(connection, "Append Row", appendRow);
  useCogsEvent(connection, "Add to existing Row", appendToRow);
  useCogsEvent(connection, "Add to existing Row with column", appendToRowWithColumn);

  return (
    <div className="App">
      <div>{!isConnected && "Not connected"}</div>
      <div>{isConnected && !googleApi && "Loading..."}</div>
    </div>
  );
}
