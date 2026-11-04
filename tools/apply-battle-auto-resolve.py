"""Sync the data-only resolver. Shared combat integration remains in index.html."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1];p=root/'index.html';s=p.read_text();block='/*SH_AUTO_BATTLE_START*/\n'+(root/'tools/modules/battle-auto-resolve.js').read_text()+'\n/*SH_AUTO_BATTLE_END*/'
pattern=r'/\*SH_AUTO_BATTLE_START\*/[\s\S]*?/\*SH_AUTO_BATTLE_END\*/'
if re.search(pattern,s):s=re.sub(pattern,lambda m:block,s)
else:s=s.replace('/*SH_REALTIME_MODEL_START*/',block+'\n\n/*SH_REALTIME_MODEL_START*/',1)
p.write_text(s)
print('Synchronized data-only battle resolver')
