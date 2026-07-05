/**
 * Scrum 看板视图组件。
 * 看板只负责列布局和拖放事件绑定，任务流转副作用由 useWorkspace 提供，
 * 让 App 不再持有看板数据筛选与交互细节。
 * 依赖：CoreWorkspace 数据；被用于：项目作战台。
 */
import type { BoardColumn, CoreWorkspace } from "../api/types.js";

const boardColumns: Array<{ id: BoardColumn; label: string }> = [
  { id: "TODO", label: "Todo" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "REVIEW", label: "Review" },
  { id: "DONE", label: "Done" }
];

interface BoardProps {
  draggingTaskId: string | null;
  moveTask: (taskId: string, boardColumn: BoardColumn) => void | Promise<void>;
  setDraggingTaskId: (taskId: string | null) => void;
  workspace: CoreWorkspace;
}

export function Board({
  draggingTaskId,
  moveTask,
  setDraggingTaskId,
  workspace
}: BoardProps) {
  return (
    <section className="board-grid" aria-label="Scrum 看板">
      {boardColumns.map((column) => (
        <section
          aria-label={column.label}
          className="board-column"
          key={column.id}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (draggingTaskId) {
              void moveTask(draggingTaskId, column.id);
              setDraggingTaskId(null);
            }
          }}
          role="region"
        >
          <h2>{column.label}</h2>
          {workspace.tasks
            .filter((task) => task.boardColumn === column.id)
            .map((task) => (
              <article
                className="task-ticket"
                draggable
                key={task.id}
                onDragStart={() => setDraggingTaskId(task.id)}
              >
                <strong>{task.title}</strong>
                <span>{task.estimateHours}h estimate</span>
              </article>
            ))}
        </section>
      ))}
    </section>
  );
}
