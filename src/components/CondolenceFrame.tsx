import React, { useState, useEffect, useRef } from "react";
import { FaComment } from "react-icons/fa";
import { db } from "../firebase";
import { collection, getDocs, addDoc, DocumentData } from "firebase/firestore";
import parthaImg from "../assets/Partha.png";

interface Comment {
  id: string; // Changed from number to string for Firestore compatibility
  text: string;
  author: string;
  x: number;
  y: number;
}

interface NewComment {
  text: string;
  author: string;
}

const CondolenceFrame: React.FC = () => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [newComment, setNewComment] = useState<NewComment>({
    text: "",
    author: "",
  });
  const [savedAuthor, setSavedAuthor] = useState<string>("");
  const [draggedComment, setDraggedComment] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const [clicks, setClicks] = useState<number[]>([]);
  const [showAddComment, setShowAddComment] = useState(true);
  const [loading, setLoading] = useState(true);

  // Function to check if position overlaps with photo area
  const isOverlappingPhoto = (
    x: number,
    y: number,
    width: number = 420,
    height: number = 100
  ) => {
    const frameRect = frameRef.current?.getBoundingClientRect();
    if (!frameRect) return false;

    const photoX = (frameRect.width - 448) / 2;
    const photoY = (frameRect.height - 512) / 2;
    const photoWidth = 448;
    const photoHeight = 512 + 60;

    return !(
      x + width < photoX ||
      x > photoX + photoWidth ||
      y + height < photoY ||
      y > photoY + photoHeight
    );
  };

  // Function to find a safe position for new comments
  const findSafePosition = (preferredX: number, preferredY: number) => {
    const frameRect = frameRef.current?.getBoundingClientRect();
    if (!frameRect) return { x: preferredX, y: preferredY };

    const commentWidth = 420;
    const commentHeight = 100;

    if (
      !isOverlappingPhoto(preferredX, preferredY, commentWidth, commentHeight)
    ) {
      return { x: preferredX, y: preferredY };
    }

    const positions = [
      { x: 50, y: 50 },
      { x: frameRect.width - commentWidth - 50, y: 50 },
      { x: 50, y: frameRect.height - commentHeight - 50 },
      {
        x: frameRect.width - commentWidth - 50,
        y: frameRect.height - commentHeight - 50,
      },
      { x: 50, y: frameRect.height / 2 - commentHeight / 2 },
      {
        x: frameRect.width - commentWidth - 50,
        y: frameRect.height / 2 - commentHeight / 2,
      },
    ];

    for (const pos of positions) {
      if (!isOverlappingPhoto(pos.x, pos.y, commentWidth, commentHeight)) {
        return pos;
      }
    }

    return { x: preferredX, y: preferredY };
  };

  // Load comments from Firestore
  const loadComments = async () => {
    try {
      setLoading(true);
      const commentsCollection = collection(db, "comments");
      const commentsSnapshot = await getDocs(commentsCollection);
      
      const loadedComments: Comment[] = [];
      commentsSnapshot.forEach((doc) => {
        const data = doc.data() as Omit<Comment, 'id'>;
        loadedComments.push({
          id: doc.id,
          ...data
        });
      });

      // Position comments safely
      const safeComments = loadedComments.map((comment) => {
        const safePos = findSafePosition(comment.x, comment.y);
        return { ...comment, ...safePos };
      });

      setComments(safeComments);
      console.log("✅ Comments loaded from Firestore:", safeComments.length);
    } catch (error) {
      console.error("❌ Error loading comments:", error);
      // Fallback to initial comment if Firestore fails
      const initialComments = [
        {
          id: "initial",
          text: "Deeply saddened by the loss, your kindness will always be remembered.",
          author: "Dhrubajyoti Ghosh",
          x: 100,
          y: 200,
        },
      ];
      
      const safeComments = initialComments.map((comment) => {
        const safePos = findSafePosition(comment.x, comment.y);
        return { ...comment, ...safePos };
      });
      
      setComments(safeComments);
    } finally {
      setLoading(false);
    }
  };

  // Load initial comments from Firestore
  useEffect(() => {
    loadComments();
  }, []);

  // Load saved author name from memory on mount
  useEffect(() => {
    const saved = savedAuthor || "";
    setSavedAuthor(saved);
    setNewComment((prev) => ({ ...prev, author: saved }));
  }, []);

  const handleFrameClick = () => {
    const now = Date.now();
    const recentClicks = [...clicks, now].filter((t) => now - t <= 500);
    if (recentClicks.length >= 3) {
      setShowAddComment(false);
      setClicks([]);
    } else {
      setClicks(recentClicks);
    }
  };

  const openModal = () => {
    setModalOpen(true);
    setNewComment({ text: "", author: savedAuthor });
  };

  const closeModal = () => {
    setModalOpen(false);
    setNewComment({ text: "", author: savedAuthor });
  };

  const getWordCount = (text: string): number =>
    text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;

  // Save comment to Firestore
  const addComment = async () => {
    if (newComment.text.trim() && newComment.author.trim()) {
      const wordCount = getWordCount(newComment.text);
      if (wordCount > 75) {
        alert(
          "Comment cannot exceed 75 words. Current word count: " + wordCount
        );
        return;
      }

      try {
        // Find a safe position for the new comment
        const baseX = 100;
        const baseY = 200 + (comments.length % 5) * 150;
        const safePos = findSafePosition(baseX, baseY);

        const commentData = {
          text: newComment.text,
          author: newComment.author,
          x: safePos.x,
          y: safePos.y,
          timestamp: new Date().toISOString()
        };

        // Add to Firestore
        const commentsCollection = collection(db, "comments");
        const docRef = await addDoc(commentsCollection, commentData);
        
        // Add to local state
        const newCommentObj: Comment = {
          id: docRef.id,
          text: newComment.text,
          author: newComment.author,
          ...safePos,
        };

        setComments([...comments, newCommentObj]);
        setSavedAuthor(newComment.author);
        closeModal();
        console.log("✅ Comment added to Firestore with ID:", docRef.id);
      } catch (error) {
        console.error("❌ Error adding comment:", error);
        alert("Failed to add comment. Please try again.");
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent, commentId: string) => {
    e.preventDefault();
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frameRect = frameRef.current?.getBoundingClientRect();
    if (!frameRect) return;
    setDraggedComment(commentId);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedComment === null) return;
    const frameRect = frameRef.current?.getBoundingClientRect();
    if (!frameRect) return;
    const newX = e.clientX - frameRect.left - dragOffset.x;
    const newY = e.clientY - frameRect.top - dragOffset.y;

    const constrainedX = Math.max(0, Math.min(newX, frameRect.width - 420));
    const constrainedY = Math.max(0, Math.min(newY, frameRect.height - 100));

    setComments((prev) =>
      prev.map((comment) =>
        comment.id === draggedComment
          ? { ...comment, x: constrainedX, y: constrainedY }
          : comment
      )
    );
  };

  const handleMouseUp = () => {
    setDraggedComment(null);
    setDragOffset({ x: 0, y: 0 });
  };

  const FloralCorner: React.FC<{ className?: string }> = ({
    className = "",
  }) => (
    <div className={`absolute w-48 h-48 overflow-hidden ${className}`}>
      <svg
        className="w-full h-full text-gray-800"
        viewBox="0 0 120 120"
        fill="currentColor"
      >
        <g transform="translate(10,10)">
          <circle cx="25" cy="25" r="12" fill="#ec4899" opacity="0.7" />
          <path
            d="M25 15 Q20 8 15 15 Q8 25 15 25 Q25 32 25 25 Q32 25 25 15 Z"
            fill="#f472b6"
          />
          <path
            d="M25 35 Q20 42 15 35 Q8 25 15 25 Q25 18 25 25 Q32 25 25 35 Z"
            fill="#f472b6"
          />
          <path
            d="M15 25 Q8 20 15 15 Q25 8 25 15 Q32 25 25 25 Q25 32 15 25 Z"
            fill="#f472b6"
          />
          <path
            d="M35 25 Q42 20 35 15 Q25 8 25 15 Q18 25 25 25 Q25 32 35 25 Z"
            fill="#f472b6"
          />
          <circle cx="25" cy="25" r="4" fill="#fbbf24" />
          <circle cx="45" cy="15" r="8" fill="#ec4899" opacity="0.6" />
          <path
            d="M45 10 Q42 6 38 10 Q34 15 38 15 Q45 20 45 15 Q50 15 45 10 Z"
            fill="#f472b6"
          />
          <circle cx="45" cy="15" r="3" fill="#fbbf24" />
          <circle cx="15" cy="45" r="8" fill="#ec4899" opacity="0.6" />
          <path
            d="M15 40 Q12 36 8 40 Q4 45 8 45 Q15 50 15 45 Q20 45 15 40 Z"
            fill="#f472b6"
          />
          <circle cx="15" cy="45" r="3" fill="#fbbf24" />
        </g>
        <path
          d="M5 5 Q15 15 25 5 Q35 15 45 5 Q55 15 65 5"
          stroke="#16a34a"
          strokeWidth="3"
          fill="none"
        />
        <ellipse
          cx="20"
          cy="35"
          rx="8"
          ry="4"
          fill="#22c55e"
          opacity="0.6"
          transform="rotate(45 20 35)"
        />
        <ellipse
          cx="35"
          cy="50"
          rx="6"
          ry="3"
          fill="#22c55e"
          opacity="0.6"
          transform="rotate(-30 35 50)"
        />
        <ellipse
          cx="50"
          cy="20"
          rx="6"
          ry="3"
          fill="#22c55e"
          opacity="0.6"
          transform="rotate(60 50 20)"
        />
        <circle cx="55" cy="35" r="3" fill="#f472b6" opacity="0.8" />
        <circle cx="35" cy="65" r="2.5" fill="#ec4899" opacity="0.8" />
        <circle cx="65" cy="50" r="2" fill="#f472b6" opacity="0.8" />
      </svg>
    </div>
  );

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-100 to-gray-200 h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading comments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-100 to-gray-200 h-screen overflow-hidden">
      <div className="h-screen p-1">
        <div className="w-full h-full relative bg-white shadow-2xl overflow-hidden">
          <div className="absolute inset-0 border-24 bg-gradient-to-br from-gray-800 via-cyan-300 to-black shadow-inner">
            <div className="absolute inset-2 border-6 border-amber-600 bg-gradient-to-r from-amber-100 via-amber-50 to-amber-100 shadow-inner">
              <div className="absolute inset-2 border-4 border-pink-300 bg-gradient-to-br from-pink-50 via-white to-pink-50">
                <FloralCorner className="top-0 left-0" />
                <FloralCorner className="top-0 right-0 rotate-90" />
                <FloralCorner className="bottom-0 left-0 -rotate-90" />
                <FloralCorner className="bottom-0 right-0 rotate-180" />

                <div
                  ref={frameRef}
                  className="relative z-10 h-full flex items-center justify-center p-48"
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onClick={handleFrameClick}
                >
                  <div className="flex flex-col items-center justify-center">
                    <div className="relative mb-4">
                      <div className="w-[28rem] h-[32rem] bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden shadow-xl">
                        <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                          <img
                            src={parthaImg}
                            alt="Partha Kabi"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border-2 border-pink-400 rounded-lg py-1 px-6 shadow-md">
                      <h2 className="text-sm font-bold text-gray-800">
                        Partha Kabi 1981-2025
                      </h2>
                    </div>
                  </div>

                  {showAddComment && (
                    <button
                      onClick={openModal}
                      className="absolute top-8 right-8 bg-pink-500 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-pink-600 transition-colors font-medium z-20"
                    >
                      + Add Comment
                    </button>
                  )}

                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`absolute flex items-start space-x-2 cursor-move select-none ${
                        draggedComment === comment.id ? "z-30" : "z-10"
                      }`}
                      style={{
                        left: `${comment.x}px`,
                        top: `${comment.y}px`,
                        width: "max-content",
                        maxWidth: "420px",
                      }}
                      onMouseDown={(e) => handleMouseDown(e, comment.id)}
                    >
                      <FaComment className="text-sky-500 text-3xl mt-12" />
                      <div className="bg-white border-2 border-pink-300 rounded-lg p-3 shadow-md">
                        <p className="text-xs text-gray-700 mb-2 leading-relaxed break-words">
                          {comment.text}
                        </p>
                        <p className="text-xs text-pink-600 font-medium break-words">
                          - {comment.author}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Add Comment
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={newComment.author}
                  onChange={(e) =>
                    setNewComment({ ...newComment, author: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-pink-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                  placeholder="Enter your name..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comment (Max 75 words)
                </label>
                <textarea
                  value={newComment.text}
                  onChange={(e) =>
                    setNewComment({ ...newComment, text: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-pink-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                  rows={4}
                  placeholder="Enter your comment..."
                />
                <div className="text-xs text-gray-500 mt-1">
                  Words: {getWordCount(newComment.text)}/75
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={addComment}
                disabled={
                  !newComment.text.trim() ||
                  !newComment.author.trim() ||
                  getWordCount(newComment.text) > 75
                }
                className="px-4 py-2 bg-pink-500 text-white rounded-md hover:bg-pink-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
              >
                Add Comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CondolenceFrame;