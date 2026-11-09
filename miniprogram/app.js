const { envId } = require('./config');
App({
  globalData: { configured: false },
  onLaunch() {
    if (envId && wx.cloud) {
      wx.cloud.init({ env: envId, traceUser: false });
      this.globalData.configured = true;
    }
  }
});
