import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { getNoteText, saveNote } from '../../services/items';

export function NoteEditor({ itemId }: { itemId: string }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    void getNoteText(itemId).then((t) => {
      setText(t);
      setLoaded(true);
    });
  }, [itemId]);

  if (!loaded) return null;
  return (
    <div className="card">
      <button onClick={() => setPreview((p) => !p)}>{preview ? 'Edit' : 'Preview'}</button>
      {preview ? (
        <ReactMarkdown>{text}</ReactMarkdown>
      ) : (
        <textarea
          className="note"
          aria-label="Notes"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => void saveNote(itemId, text)}
        />
      )}
    </div>
  );
}
