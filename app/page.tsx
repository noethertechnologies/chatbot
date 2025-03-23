"use client";
import { useState, useEffect, useRef } from "react";

// ChatMessage type to structure the messages
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// Helper function that splits a message string into parts: plain text and code blocks.
function parseContent(content: string) {
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  const parts: { type: "text" | "code"; content: string; language?: string }[] = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    // Push text before the code block, if any.
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: content.substring(lastIndex, match.index),
      });
    }
    // Push the code block.
    parts.push({
      type: "code",
      language: match[1] || "",
      content: match[2],
    });
    lastIndex = regex.lastIndex;
  }
  // Push remaining text after the last code block.
  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.substring(lastIndex) });
  }
  return parts;
}

const ChatPage = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const chatBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  // Copies given text to clipboard.
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Code block copied to clipboard!");
  };

  // Renders message content; for assistant messages, it splits out code blocks.
  const renderMessageContent = (message: ChatMessage) => {
    if (message.role === "assistant") {
      const parts = parseContent(message.content);
      return parts.map((part, idx) => {
        if (part.type === "code") {
          return (
            <div key={idx} className="relative my-2">
              <button
                onClick={() => copyToClipboard(part.content)}
                className="absolute top-2 right-2 bg-gray-700 text-white px-2 py-1 rounded text-xs hover:bg-gray-600"
              >
                Copy
              </button>
              <pre className="bg-gray-800 text-green-200 p-4 rounded overflow-x-auto">
                <code>{part.content}</code>
              </pre>
            </div>
          );
        } else {
          return (
            <p key={idx} className="text-gray-800 my-2">
              {part.content}
            </p>
          );
        }
      });
    } else {
      // For user messages, render normally.
      return <p className="text-white">{message.content}</p>;
    }
  };

  // Function to handle sending a message and streaming the API response.
  const sendMessage = async () => {
    if (!inputValue.trim()) return; // Require non-empty text

    const userMessage: ChatMessage = { role: "user", content: inputValue };
    setMessages((prev) => [...prev, userMessage]);
    const prompt = inputValue;
    setInputValue(""); // Clear input field

    try {
      const response = await fetch("/api/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to fetch response");
      }

      if (!response.body) {
        throw new Error("ReadableStream not supported in this browser.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantContent = "";
      // Add a placeholder for the assistant message.
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;
        // Update the last assistant message with the accumulated content.
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantContent };
          return updated;
        });
      }
    } catch (error) {
      console.error("Error fetching AI response:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: Unable to fetch response." },
      ]);
    }
  };

  return (
    <div className="flex flex-col justify-between h-screen w-screen p-6 bg-gray-100">
      <div
        className="flex-1 overflow-y-auto p-5 space-y-4 bg-white rounded-lg shadow-lg"
        ref={chatBoxRef}
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`p-4 rounded-2xl w-[70%] break-words font-bold relative ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-black"
              }`}
              style={{ whiteSpace: "pre-wrap" }}
            >
              {renderMessageContent(message)}
            </div>
          </div>
        ))}
      </div>

      <div className="flex mt-4 space-x-4">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 p-4 border rounded-2xl border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-black"
        />
        <button
          onClick={sendMessage}
          className="px-6 py-4 bg-blue-500 text-white rounded-2xl hover:bg-blue-600"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatPage;
