/**
 * POS側の画面（スタッフ向け）にグローバルアラートを表示する関数
 * @param {Object} data - system_alerts のデータオブジェクト
 */
export function renderPosAlert(data) {
  const existingAlert = document.getElementById("pos-global-alert");
  if (existingAlert) {
    existingAlert.remove();
  }

  if (!data || !data.posAlertActive || !data.posAlertMessage) return;

  let bgColor = "var(--danger-color, #ef4444)";
  let icon = "bi-exclamation-triangle-fill";
  if (data.posAlertType === "warning") {
    bgColor = "#f59e0b";
    icon = "bi-exclamation-circle-fill";
  } else if (data.posAlertType === "info") {
    bgColor = "#3b82f6";
    icon = "bi-info-circle-fill";
  }

  const alertHtml = `
    <div id="pos-global-alert" style="
      background-color: ${bgColor};
      color: white;
      padding: 10px 16px;
      font-size: 0.9rem;
      font-weight: bold;
      text-align: center;
      position: sticky;
      top: 0;
      z-index: 10000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-shrink: 0;
      width: 100%;
    ">
      <i class="bi ${icon}"></i>
      <span>${data.posAlertMessage.replace(/\n/g, "<br>")}</span>
    </div>
  `;
  
  const topBar = document.querySelector(".top-bar");
  if (topBar) {
    topBar.insertAdjacentHTML("afterend", alertHtml);
  } else {
    document.body.insertAdjacentHTML("afterbegin", alertHtml);
  }
}
