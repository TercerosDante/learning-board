import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { captureNow } from '../../services/captures';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const location = useLocation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && e.ctrlKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  const save = async () => {
    if (text.trim()) await captureNow({ text: text.trim(), route: location.pathname });
    setText('');
    setOpen(false);
  };

  return (
    <div>
      <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} title="Quick capture (Ctrl+K)">
        + Capture
      </Button>
      {open && (
        <Card className="fixed right-4 top-14 z-10 w-96 shadow-lg">
          <CardContent className="space-y-2 pt-4">
            <Textarea
              ref={textareaRef}
              aria-label="Quick capture"
              placeholder="Stray thought, link, question… (Ctrl+Enter saves)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) void save();
              }}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void save()}>
                Save to inbox
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
