export type AuthStackParamList = {
  Login: undefined;
};

export type ParentTabParamList = {
  Dashboard: undefined;
  Children: undefined;
  CreateTask: undefined;
  Approvals: undefined;
  Settings: undefined;
};

export type ChildTasksStackParamList = {
  TaskList: undefined;
  TaskDetail: { taskId: string };
};

export type ChildTabParamList = {
  Home: undefined;
  TasksStack: undefined;
  Wallet: undefined;
  Rewards: undefined;
};
