# assets/art

Drop PNGs here and they replace the code-defined sprite of the same id
everywhere in the game. No manifest to edit, no import to add — the build
globs this folder.

    assets/art/<category>/<sprite-id>.png
    assets/art/<category>/<sprite-id>@<frames>.png

The id must match a sprite id from `data/sprites/*.ts` (or be a new id a
mini-game asks for). Frames go left to right in one row, equal width, no
padding. Author at 1x on the pixel grid; the engine upscales by whole numbers.

`docs/ASSET-REQUESTS.md` is the list of what is actually wanted, with the grid
size and frame count for each.
