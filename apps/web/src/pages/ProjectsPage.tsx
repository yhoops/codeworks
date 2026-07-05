/**
 * 项目作战台页面。
 * 页面只组合项目摘要、Board 和工时/排期表单，所有数据加载与业务动作由 useWorkspace 提供。
 * 这让后续外壳和视觉修复可以不触碰 Core API 编排。
 * 依赖：useWorkspace 返回值与 Board；被用于：App 的 /projects 路由。
 */
import { Board } from "../components/Board.js";
import type { useWorkspace } from "../hooks/useWorkspace.js";

type WorkspaceState = ReturnType<typeof useWorkspace>;

interface ProjectsPageProps {
  actualHours: WorkspaceState["actualHours"];
  correctTime: WorkspaceState["correctTime"];
  draggingTaskId: WorkspaceState["draggingTaskId"];
  latestTimeEntry: WorkspaceState["latestTimeEntry"];
  moveTask: WorkspaceState["moveTask"];
  plannedHours: WorkspaceState["plannedHours"];
  primaryEmployee: WorkspaceState["primaryEmployee"];
  primaryProject: WorkspaceState["primaryProject"];
  scheduleAllocation: WorkspaceState["scheduleAllocation"];
  setActualHours: WorkspaceState["setActualHours"];
  setDraggingTaskId: WorkspaceState["setDraggingTaskId"];
  setPlannedHours: WorkspaceState["setPlannedHours"];
  status: string;
  utilization: WorkspaceState["utilization"];
  workspace: WorkspaceState["workspace"];
}

export function ProjectsPage({
  actualHours,
  correctTime,
  draggingTaskId,
  latestTimeEntry,
  moveTask,
  plannedHours,
  primaryEmployee,
  primaryProject,
  scheduleAllocation,
  setActualHours,
  setDraggingTaskId,
  setPlannedHours,
  status,
  utilization,
  workspace
}: ProjectsPageProps) {
  return (
    <section className="core-page" aria-labelledby="core-title">
      <p className="eyebrow">Project operating surface</p>
      <h1 id="core-title">项目作战台</h1>
      <p className="subtitle">
        看板、实际工时和排期在同一页闭环，所有操作通过 Core API 同步。
      </p>

      {!workspace ? (
        <p className="status-line" role="status">
          {status}
        </p>
      ) : (
        <>
          <section className="project-strip" aria-label="项目列表">
            <strong>{primaryProject?.name ?? "暂无项目"}</strong>
            <span>{workspace.tasks.length} tasks</span>
            <span>{primaryEmployee?.name ?? "未分配负责人"}</span>
          </section>

          <Board
            draggingTaskId={draggingTaskId}
            moveTask={moveTask}
            setDraggingTaskId={setDraggingTaskId}
            workspace={workspace}
          />

          <section className="operations-panel" aria-label="工时与排期">
            <div>
              <h2>工时校正</h2>
              <p>
                {latestTimeEntry
                  ? `实际工时 ${latestTimeEntry.hours}h`
                  : "等待任务完成生成实际工时"}
              </p>
              <label htmlFor="actual-hours">实际工时</label>
              <input
                id="actual-hours"
                onChange={(event) => setActualHours(event.target.value)}
                type="number"
                value={actualHours}
              />
              <button className="primary-action" onClick={correctTime} type="button">
                校正工时
              </button>
            </div>

            <div>
              <h2>资源排期</h2>
              <p>
                {utilization
                  ? `${utilization.plannedHours}h / ${utilization.availableHours}h`
                  : "本周容量等待排期"}
              </p>
              <label htmlFor="planned-hours">计划排期</label>
              <input
                id="planned-hours"
                onChange={(event) => setPlannedHours(event.target.value)}
                type="number"
                value={plannedHours}
              />
              <button className="primary-action" onClick={scheduleAllocation} type="button">
                保存排期
              </button>
            </div>
          </section>

          <p className="status-line" role="status">
            {status}
          </p>
        </>
      )}
    </section>
  );
}
