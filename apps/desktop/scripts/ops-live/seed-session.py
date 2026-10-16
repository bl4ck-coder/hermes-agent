"""P27 (judge pass 21 #5): seed one stored chat session with a long history into the SANDBOX Hermes home used by
hard.mjs, so the chat hard state can open an EXISTING session (resumed through the sandbox gateway, as a user would)
and have only its prompt.submit refused.

Usage: python seed-session.py <session_id> <title> <turns> <last_marker>
       python seed-session.py --delete <session_id>   (the state's cleanup: the sandbox goes back to no session, so
                                                       the empty Sessions/Artifacts states of the next run stay empty)
  HERMES_HOME must be set and must not be the real Hermes home (%LOCALAPPDATA%/hermes or under it).
Idempotent: an existing session with at least 2*turns messages is left as it is.
Prints one JSON line: {"session_id", "messages", "created"}.
"""

import json
import os
import sys
import time
from pathlib import Path


def main() -> int:
    delete = len(sys.argv) == 3 and sys.argv[1] == '--delete'
    if len(sys.argv) != 5 and not delete:
        print(__doc__, file=sys.stderr)
        return 2
    if delete:
        sid, title, turns, last_marker = sys.argv[2], '', 0, ''
    else:
        sid, title, turns, last_marker = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
    home = os.environ.get('HERMES_HOME', '')
    real = Path(os.environ.get('LOCALAPPDATA', '~')).expanduser() / 'hermes'
    if not home:
        print('HERMES_HOME is not set (sandbox home required)', file=sys.stderr)
        return 4
    h = Path(home).resolve()
    r = real.resolve()
    if h == r or r in h.parents:
        print(f'refusing to seed the real Hermes home: {h}', file=sys.stderr)
        return 4

    # This checkout's state layer (this file is <repo>/apps/desktop/scripts/ops-live/seed-session.py), not whatever the venv has installed.
    sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
    from hermes_state import SessionDB

    db = SessionDB()
    if delete:
        gone = bool(db.get_session(sid)) and db.delete_session(sid)
        print(json.dumps({'session_id': sid, 'deleted': bool(gone), 'remaining': bool(db.get_session(sid))}))
        db.close()
        return 0
    existing = db.get_session(sid)
    if existing:
        have = len(db.get_messages(sid))
        if have >= 2 * turns:
            print(json.dumps({'session_id': sid, 'messages': have, 'created': False}))
            return 0
    db.create_session(sid, 'desktop', model='mock-model', profile_name='default')
    try:
        db.set_session_title(sid, title)
    except Exception as e:  # a title collision must not stop the seed: the transcript is what the state needs
        print(f'title not set: {e}', file=sys.stderr)
    t0 = time.time() - 3600
    for i in range(turns):
        last = i == turns - 1
        db.append_message(sid, 'user', f'Turn {i + 1}: check the release checklist item {i + 1} and tell me what is left.', timestamp=t0 + i * 60)
        body = (
            f'Item {i + 1} is done: the build passed, the changelog entry is written and the reviewer signed off. '
            f'Nothing is left for this item; the next one is item {i + 2}.'
        )
        if last:
            body = f'{last_marker} Item {i + 1} is the last one and it is done.'
        db.append_message(sid, 'assistant', body, timestamp=t0 + i * 60 + 30)
    print(json.dumps({'session_id': sid, 'messages': len(db.get_messages(sid)), 'created': True}))
    db.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
