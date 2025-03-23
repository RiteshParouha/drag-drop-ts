// Drag and Drop Interfacees

interface Draggable {
  dragStartHandler(event: DragEvent): void;
  dragEndHandler(event: DragEvent): void;
}

interface DragTarget {
  dragOverHandler(event: DragEvent): void; // --> To signle the browser that it's correct position to drop.
  dropHandler(event: DragEvent): void;
  dragLeaveHandler(event: DragEvent): void;
}

enum ProjectStatus {
  Active,
  Finished,
}

class Project {
  constructor(
    public id: string,
    public title: string,
    public description: string,
    public people: number,
    public status: ProjectStatus
  ) {}
}

interface Validatable {
  value: string | number;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

function validate(obj: Validatable): boolean {
  let isValid = true;

  if (obj.required) {
    isValid = isValid && obj.value.toString().trim().length !== 0;
  }
  if (obj.minLength && typeof obj.value == "string") {
    isValid = isValid && obj.value.length >= obj.minLength;
  }
  if (obj.maxLength && typeof obj.value == "string") {
    isValid = isValid && obj.value.length <= obj.maxLength;
  }
  if (obj.max && typeof obj.value == "number") {
    isValid = isValid && obj.value <= obj.max;
  }
  if (obj.min && typeof obj.value == "number") {
    isValid = isValid && obj.value >= obj.min;
  }

  return isValid;
}

function AutoBind(
  _: (...args: any[]) => any,
  ctxt: ClassMethodDecoratorContext
) {
  ctxt.addInitializer(function (this: any) {
    this[ctxt.name] = this[ctxt.name].bind(this);
  });
}

type Listener = (item: Project[]) => void;

// --> State management class which is also a singleton constructor.
class ProjectState {
  projects: Project[] = [];
  listeners: Listener[] = []; // -> Used to store a function which will get called for each change in state to render the new list in the project
  private static instance: ProjectState;

  private constructor() {}

  static getInstance() {
    if (this.instance) {
      return this.instance;
    }

    this.instance = new ProjectState();
    return this.instance;
  }
  addListener(listnerFn: Listener) {
    this.listeners.push(listnerFn);
  }

  addProject(title: string, description: string, noOfPeople: number) {
    const project = new Project(
      Math.random().toString(),
      title,
      description,
      noOfPeople,
      ProjectStatus.Active
    );

    this.projects.push(project);

    for (let listenerFn of this.listeners) {
      listenerFn([...this.projects]);
    }
  }

  switchProject(prjId: string, status: ProjectStatus) {
    const project = this.projects.find((prj) => prj.id === prjId);

    if (project) {
      project.status = status;
      for (let listenerFn of this.listeners) {
        listenerFn([...this.projects]);
      }
    }
    console.log(status, "status", project);
  }
}

const projectState = ProjectState.getInstance();


// --> Used to select a tempelate and attach to the parent node that has been passed to the constructor.
abstract class Component<T extends HTMLElement, U extends HTMLElement> {
  tempelateElement: HTMLTemplateElement;
  rootElement: T;
  element: U;

  constructor(
    tempelateId: string,
    hostElementId: string,
    appendToStart: boolean,
    elementId?: string
  ) {
    this.tempelateElement = document.getElementById(
      tempelateId
    ) as HTMLTemplateElement;
    this.rootElement = document.getElementById(hostElementId)! as T;
    const importedNode = document.importNode(
      this.tempelateElement.content,
      true
    ); // --> It just creates a copy of the node. 2nd arguemnet is used to tell the function to also include the subTree of the parent node.

    this.element = importedNode.firstElementChild! as U;
    this.element.id = elementId || "";
    this.attach(appendToStart);
  }

  private attach(appendToStart: boolean) {
    this.rootElement.insertAdjacentElement(
      appendToStart ? "afterbegin" : "beforeend",
      this.element
    );
  }

  abstract renderContent(): void;
  abstract configure(): void;
}

class ProjectItem
  extends Component<HTMLUListElement, HTMLLIElement>
  implements Draggable
{
  private project: Project;

  constructor(hostId: string, project: Project) {
    super("single-project", hostId, false, project.id);
    this.project = project;
    this.renderContent();
    this.configure();
  }

  // -> We are using drag in this class because we are only going to drag any specfic li element.
  @AutoBind
  dragStartHandler(event: DragEvent): void {
    event.dataTransfer!.setData("text/plain", this.project.id);
  }

  dragEndHandler(_event: DragEvent): void {
    console.log("End", _event);
  }

  configure(): void {
    this.element.addEventListener("dragstart", this.dragStartHandler);
    this.element.addEventListener("dragend", this.dragEndHandler);
  }

  renderContent(): void {
    // console.log(this.element,"item");
    this.element.querySelector("h1")!.textContent = this.project.title;
    this.element.querySelector("h3")!.textContent =
      this.project.people.toString();
    this.element.querySelector("p")!.textContent = this.project.description;
  }
}

class ProjectList
  extends Component<HTMLDivElement, HTMLElement>
  implements DragTarget
{
  assignedProject: Project[];

  constructor(private type: "active" | "finished") {
    super("project-list", "app", false, `${type}-projects`);

    this.assignedProject = [];

    this.configure();
    this.renderContent();
  }

  @AutoBind
  dragOverHandler(event: DragEvent): void {
    if (event.dataTransfer && event.dataTransfer.types[0] == "text/plain") {
      event.preventDefault();
      const ul = this.element.querySelector("ul");
      ul?.classList.add("droppable");
    }
  }
  @AutoBind
  dragLeaveHandler(_event: DragEvent): void {
    const ul = this.element.querySelector("ul");
    ul?.classList.remove("droppable");
  }
  @AutoBind
  dropHandler(event: DragEvent): void {
    // console.log(event.dataTransfer?.getData('text/plain'),"drop");
    const id = event.dataTransfer?.getData("text/plain");

    console.log(this.type);
    if (id) {
      projectState.switchProject(
        id,
        this.type == "active" ? ProjectStatus.Active : ProjectStatus.Finished
      );
    }
  }

  configure() {
    this.element?.addEventListener("dragover", this.dragOverHandler);
    this.element?.addEventListener("drop", this.dropHandler);
    this.element?.addEventListener("dragleave", this.dragLeaveHandler);

    // --> this function got added in the listeners object and now for each change in state the same anonymous function will get called and it will also call the render list function.
    projectState.addListener((projects: Project[]) => {
      this.assignedProject = projects; // this is closure;
      this.renderList();
    });
  }

  renderContent() {
    const id = `${this.type}-project-list`;
    // console.log(this.element.querySelector("ul"));
    this.element.querySelector("ul")!.id = id;
    this.element.querySelector("h2")!.textContent =
      this.type.toUpperCase() + " PROJECTS";
  }

  private renderList() {
    // const list = document.getElementById(`${this.type}-project-list`);
    const filteredProjects = this.assignedProject.filter((project) => {
      if (this.type == "active") {
        return project.status == ProjectStatus.Active;
      }
      return project.status == ProjectStatus.Finished;
    });

    this.element.querySelector("ul")!.textContent = "";

    for (let project of filteredProjects) {
      // --> Here Id field diffrentiates the which element it is either an active ele or finished
      new ProjectItem(this.element.querySelector("ul")!.id, project);
    }
  }
}

class ProjectInput extends Component<HTMLDivElement, HTMLElement> {
  titleInputEl: HTMLInputElement;
  descInputEl: HTMLInputElement;
  peopleInputEl: HTMLInputElement;

  constructor() {
    super("project-input", "app", true, "user-input");

    this.titleInputEl = this.element.querySelector(
      "#title"
    ) as HTMLInputElement;
    this.descInputEl = this.element.querySelector(
      "#description"
    ) as HTMLInputElement;
    this.peopleInputEl = this.element.querySelector(
      "#people"
    ) as HTMLInputElement;

    this.configure();
  }

  configure() {
    this.element.addEventListener("submit", this.submitHandler);
  }

  renderContent(): void {}

  private gatherUserInput(): [string, string, number] | void {
    const title = this.titleInputEl.value;
    const desc = this.descInputEl.value;
    const people = this.peopleInputEl.value;

    const validatableTitle = {
      value: title,
      required: true,
    };
    const validatableDesc = {
      value: desc,
      required: true,
    };
    const validatablePeople = {
      value: +people,
      required: true,
      min: 5,
    };

    if (
      !validate(validatableTitle) ||
      !validate(validatableDesc) ||
      !validate(validatablePeople)
    ) {
      alert("Invalid input");
    } else {
      return [title, desc, +people];
    }
  }

  @AutoBind
  private submitHandler(event: Event) {
    event.preventDefault();
    const userInput = this.gatherUserInput();
    this.clear();

    if (Array.isArray(userInput)) {
      const [title, desc, people] = userInput;
      projectState.addProject(title, desc, people);
    }
  }

  private clear() {
    this.titleInputEl.value = "";
    this.descInputEl.value = "";
    this.peopleInputEl.value = "";
  }
}

const prjctInpt = new ProjectInput();
const activeList = new ProjectList("active");
const finishedList = new ProjectList("finished");
