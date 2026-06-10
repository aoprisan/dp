class ToastState {
  message = $state('');
  visible = $state(false);
  #timer: ReturnType<typeof setTimeout> | null = null;

  show(html: string) {
    this.message = html;
    this.visible = true;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.visible = false;
    }, 2400);
  }
}

export const toast = new ToastState();
