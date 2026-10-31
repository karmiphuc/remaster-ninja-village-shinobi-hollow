# Working on Shinobi Hollow

- The playable source is the standalone `index.html`. Preserve existing art, game balance, saves and concurrent feature work when making a focused change.
- Before changing village structures, fixed props or their placement, read [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) and compare against its procedural reference sheet. Match the existing pixel scale, outline weight, material palette and shading. **Roofs are optional**; matching the rendering language does not require every building to be a roofed house.
- The Porter House must retain a clearly visible wooden cart or wheelbarrow in front, including when no workers are assigned. Keep its tray, handles and wheel distinct from the foundation.
- Keep the Porter House registration and sprite in `tools/modules/economy-p0.js` synchronized with the corresponding code in `index.html`. Historical build scripts and `baseline/` are not the current playable source.
- For new buildings, verify the real Build menu, placement and assignment flow; a direct `place()` fixture alone cannot establish that players can build them.
