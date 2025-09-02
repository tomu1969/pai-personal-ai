describe('Project Setup', () => {
  it('should have Jest configured correctly', () => {
    expect(true).toBe(true);
  });

  it('should load environment variables', () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });
});