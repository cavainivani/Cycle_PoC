import { DIVISION_OPTIONS } from "../config/options.js";
import { esc } from "../core/format.js";
import { settings } from "../state/settings.js";
export function renderSystemSettingsView(){
  return `
    <div class="topbar">
      <div><h1>시스템 설정</h1><div class="desc">로그인 시 사용하는 관리자(admin)·PMO 암호를 각각 관리합니다. 이 화면은 관리자로 로그인했을 때만 접근할 수 있습니다.</div></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>관리자(admin) 암호</h3></div>
      <div class="panel-body">
        <div class="form-grid single">
          <div class="field"><label>새 암호</label><input type="password" id="sys_adminPw" placeholder="새 암호 입력" autocomplete="new-password"></div>
          <div class="field"><label>새 암호 확인</label><input type="password" id="sys_adminPw2" placeholder="새 암호 다시 입력" autocomplete="new-password"></div>
        </div>
      </div>
      <div class="drawer-foot"><button class="btn btn-primary" data-save-sys-pw="admin">관리자 암호 변경</button></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>PMO 암호</h3></div>
      <div class="panel-body">
        <div class="form-grid single">
          <div class="field"><label>새 암호</label><input type="password" id="sys_pmoPw" placeholder="새 암호 입력" autocomplete="new-password"></div>
          <div class="field"><label>새 암호 확인</label><input type="password" id="sys_pmoPw2" placeholder="새 암호 다시 입력" autocomplete="new-password"></div>
        </div>
      </div>
      <div class="drawer-foot"><button class="btn btn-primary" data-save-sys-pw="pmo">PMO 암호 변경</button></div>
    </div>
    <div class="hint" style="margin:4px 2px 0 0;">변경한 암호는 모든 사용자에게 즉시 적용됩니다.</div>
    <div class="panel" style="margin-top:16px;">
      <div class="panel-head"><h3>알림 기준일 설정</h3></div>
      <div class="panel-body">
        <div class="hint" style="margin-bottom:10px;">수습 관리·계약 관리 화면에서 "얼마나 임박한 건까지 대상으로 볼지"를 정하는 기준일입니다. 관리자·PMO 계정 공통으로 적용되며, 표준값은 30일입니다.</div>
        <div class="form-grid">
          <div class="field"><label>수습 평가 알림 기준일</label><input type="number" id="sys_alertProbation" min="1" value="${esc(settings.alertDays.probation)}"><div class="hint">수습 종료 예정일까지 이 일수 이내로 남은 인원을 "수습 평가 대상자"로 집계합니다.</div></div>
          <div class="field"><label>계약 갱신 알림 기준일</label><input type="number" id="sys_alertContract" min="1" value="${esc(settings.alertDays.contract)}"><div class="hint">최종 계약일 기준 만 1년 시점까지 이 일수 이내(또는 이미 지난) 직원을 계약 관리 "대기 리스트"에 표시합니다.</div></div>
        </div>
      </div>
      <div class="drawer-foot"><button class="btn btn-primary" id="btnSaveAlertDays">알림 기준일 저장</button></div>
    </div>
    <div class="panel" style="margin-top:16px;">
      <div class="panel-head"><h3>표시 사업부 설정 (관리자 계정용)</h3></div>
      <div class="panel-body">
        <div class="hint" style="margin-bottom:10px;">선택한 사업부만 체크하면, 적용 즉시 <strong>관리자(admin)로 로그인한 사용자</strong>의 모든 화면이 선택한 사업부의 인력·데이터만 보이도록 제한됩니다. PMO 계정의 화면 범위에는 영향을 주지 않습니다. 아무 것도 선택하지 않고 적용하거나 "전체 보기"를 누르면 제한이 해제됩니다.</div>
        <div class="checkbox-grid" style="display:flex; flex-wrap:wrap; gap:10px 18px;">
          ${DIVISION_OPTIONS.map(d=>`
            <label style="display:flex; align-items:center; gap:6px; font-size:13px;">
              <input type="checkbox" data-div-checkbox="admin" value="${esc(d)}" ${(settings.visibleDivisions.admin.length===0 || settings.visibleDivisions.admin.includes(d))?"checked":""}>
              ${esc(d)}
            </label>
          `).join("")}
        </div>
        <div class="hint" style="margin-top:10px;">
          현재 적용된 범위(관리자): ${settings.visibleDivisions.admin.length ? esc(settings.visibleDivisions.admin.join(", ")) : "전체 사업부 (제한 없음)"}
        </div>
      </div>
      <div class="drawer-foot" style="display:flex; gap:8px;">
        <button class="btn btn-primary" data-apply-division-scope="admin">선택한 사업부만 보기 적용</button>
        <button class="btn" data-clear-division-scope="admin">전체 보기 (제한 해제)</button>
      </div>
    </div>
    <div class="panel" style="margin-top:16px;">
      <div class="panel-head"><h3>표시 사업부 설정 (PMO 계정용)</h3></div>
      <div class="panel-body">
        <div class="hint" style="margin-bottom:10px;">선택한 사업부만 체크하면, 적용 즉시 <strong>PMO로 로그인한 사용자</strong>의 모든 화면이 선택한 사업부의 인력·데이터만 보이도록 제한됩니다. 관리자 계정의 화면 범위에는 영향을 주지 않습니다. 아무 것도 선택하지 않고 적용하거나 "전체 보기"를 누르면 제한이 해제됩니다.</div>
        <div class="checkbox-grid" style="display:flex; flex-wrap:wrap; gap:10px 18px;">
          ${DIVISION_OPTIONS.map(d=>`
            <label style="display:flex; align-items:center; gap:6px; font-size:13px;">
              <input type="checkbox" data-div-checkbox="pmo" value="${esc(d)}" ${settings.visibleDivisions.pmo.includes(d)?"checked":""}>
              ${esc(d)}
            </label>
          `).join("")}
        </div>
        <div class="hint" style="margin-top:10px;">
          현재 적용된 범위(PMO): ${settings.visibleDivisions.pmo.length ? esc(settings.visibleDivisions.pmo.join(", ")) : "전체 사업부 (제한 없음)"}
        </div>
      </div>
      <div class="drawer-foot" style="display:flex; gap:8px;">
        <button class="btn btn-primary" data-apply-division-scope="pmo">선택한 사업부만 보기 적용</button>
        <button class="btn" data-clear-division-scope="pmo">전체 보기 (제한 해제)</button>
      </div>
    </div>
  `;
}
