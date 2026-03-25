export const loadUserGuideContent = async (isEnglish: boolean): Promise<string> => {
  if (isEnglish) {
    const module = await import('@root/USER_GUIDE_EN.md?raw');
    return module.default;
  }

  const module = await import('@root/USER_GUIDE.md?raw');
  return module.default;
};
