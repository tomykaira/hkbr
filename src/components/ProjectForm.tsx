import { useState, type FormEvent } from "react";
import { LIMITS, type ProjectInput } from "../../shared/api";
import { errorMessage } from "../api";
import { fromLocalInput, toLocalInput } from "../datetime";

interface Props {
  initial?: ProjectInput;
  /** お題締切後: 作品提出締め切りのみ編集可 */
  workDeadlineOnly?: boolean;
  submitLabel: string;
  onSubmit: (input: ProjectInput) => Promise<void>;
  onCancel?: () => void;
}

export function ProjectForm({ initial, workDeadlineOnly = false, submitLabel, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [topicDeadline, setTopicDeadline] = useState(toLocalInput(initial?.topicDeadline ?? null));
  const [workDeadline, setWorkDeadline] = useState(toLocalInput(initial?.workDeadline ?? null));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const topicMs = fromLocalInput(topicDeadline);
    if (topicMs === null) {
      setError("お題提出締め切りを入力してください");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ title, description, topicDeadline: topicMs, workDeadline: fromLocalInput(workDeadline) });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      {workDeadlineOnly && (
        <p className="notice">お題提出締め切りを過ぎたため、作品提出締め切りのみ編集できます。</p>
      )}
      <label>
        タイトル
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={LIMITS.title}
          required
          disabled={workDeadlineOnly}
        />
      </label>
      <label>
        説明
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={LIMITS.description}
          rows={5}
          disabled={workDeadlineOnly}
        />
      </label>
      <label>
        お題提出締め切り
        <input
          type="datetime-local"
          value={topicDeadline}
          onChange={(e) => setTopicDeadline(e.target.value)}
          required
          disabled={workDeadlineOnly}
        />
        {!workDeadlineOnly && <span className="hint">この日時を過ぎると自動でお題が割り当てられます</span>}
      </label>
      <label>
        作品提出締め切り（任意）
        <span className="row">
          <input type="datetime-local" value={workDeadline} onChange={(e) => setWorkDeadline(e.target.value)} />
          {workDeadline && (
            <button type="button" className="ghost" onClick={() => setWorkDeadline("")}>
              未設定にする
            </button>
          )}
        </span>
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit" className="primary" disabled={busy}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel}>
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}
