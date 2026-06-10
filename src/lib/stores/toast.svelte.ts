let message = $state<string | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

export const toast = {
  get message() {
    return message;
  },
  show(msg: string) {
    message = msg;
    clearTimeout(timer);
    timer = setTimeout(() => (message = null), 2200);
  },
};
