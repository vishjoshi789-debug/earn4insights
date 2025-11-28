import React from "react";

export function FeedbackForm(props: { className?: string }) {
  return (
    <form className={props.className ?? ""} onSubmit={(e) => e.preventDefault()}>
      <label className="block mb-2">
        <span className="text-sm">Your Feedback</span>
        <textarea className="w-full mt-1 p-2 border rounded" rows={4} />
      </label>
      <button type="submit" className="px-4 py-2 rounded bg-primary text-white">
        Submit
      </button>
    </form>
  );
}

export default FeedbackForm;
