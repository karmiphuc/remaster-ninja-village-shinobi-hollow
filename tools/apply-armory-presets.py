"""Sync the finite equipment preset module; shared integration hooks live in index.html."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1];p=root/'index.html';s=p.read_text();block='/*SH_ARMORY_PRESETS_START*/\n'+(root/'tools/modules/armory-presets.js').read_text()+'\n/*SH_ARMORY_PRESETS_END*/'
pattern=r'/\*SH_ARMORY_PRESETS_START\*/[\s\S]*?/\*SH_ARMORY_PRESETS_END\*/'
if re.search(pattern,s):s=re.sub(pattern,lambda m:block,s)
else:s=s.replace('/*SH_AUTO_BATTLE_START*/',block+'\n\n/*SH_AUTO_BATTLE_START*/',1)
p.write_text(s);print('Synchronized Bugu-gura presets')
