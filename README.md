
Backend: written in Go, offers some endpoints for creating, updating, and retreiving lists

Frontend: written in Poseidon, composed of home page and a page to dynamically load / edit a list, most of routing is done on the client side which gets data via a REST-like API.

Database, use a serialized Go hash map, allows us for efficient, fast look-ups with minimum overhead for setting things up, and relatively efficiently encoded data (so small file sizes). Seralize with excellent provided `gop` package

Password: saved in an env file since this is fast and I could not be bothered to implement fully-fledged auth system

Features:
- Import from JSON/Notion?
- Render preview in home page like in preview