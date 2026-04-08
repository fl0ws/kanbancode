Add a loading spinner to the board

When the board first loads and tasks are being fetched from the server, the columns are empty for a brief moment. Add a simple loading spinner or skeleton state that shows while the initial fetch is in progress.

## Acceptance Criteria
- Show a centered spinner while tasks are loading
- Remove spinner once tasks are rendered
- Should not flash if loading is fast (under 200ms)
