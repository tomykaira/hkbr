import { api } from "../api";
import { ProjectForm } from "../components/ProjectForm";
import { navigate } from "../router";

export function NewProjectPage() {
  return (
    <section className="card">
      <h1>企画を開始する</h1>
      <ProjectForm
        submitLabel="企画を作成"
        onSubmit={async (input) => {
          const { id } = await api.createProject(input);
          navigate(`/p/${id}`);
        }}
        onCancel={() => navigate("/")}
      />
    </section>
  );
}
