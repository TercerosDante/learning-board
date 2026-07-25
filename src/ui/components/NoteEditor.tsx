import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { getNoteText, saveNote } from '../../services/items';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const SAVE_DEBOUNCE_MS = 1000;

export function NoteEditor({ itemId }: { itemId: string }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTextRef = useRef<string | null>(null);

  useEffect(() => {
    setLoaded(false);
    void getNoteText(itemId).then((t) => {
      setText(t);
      setLoaded(true);
    });
  }, [itemId]);

  // Flush any pending debounced edit when the item changes or the editor unmounts,
  // so typing followed by a fast navigation away never silently loses text.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pendingTextRef.current !== null) {
        void saveNote(itemId, pendingTextRef.current);
        pendingTextRef.current = null;
      }
    };
  }, [itemId]);

  const handleChange = (value: string) => {
    setText(value);
    pendingTextRef.current = value;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      void saveNote(itemId, value);
      pendingTextRef.current = null;
      timeoutRef.current = null;
    }, SAVE_DEBOUNCE_MS);
  };

  const handleBlur = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingTextRef.current = null;
    void saveNote(itemId, text);
  };

  if (!loaded) return null;
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <Button size="sm" variant="outline" onClick={() => setPreview((p) => !p)}>
        {preview ? 'Edit' : 'Preview'}
      </Button>
      {preview ? (
        <div className="text-sm">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      ) : (
        <Textarea
          className="min-h-48 font-mono"
          aria-label="Notes"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
        />
      )}
    </div>
  );
}
