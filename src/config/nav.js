export const NAV_GROUPS = [
  { label:"대시보드", items:[
    {key:"dashboard", label:"대시보드", icon:"dashboard"},
  ]},
  { label:"평가 · 보상", items:[
    {key:"probation", label:"수습 관리", icon:"clock", countKey:"probationTargets"},
    {key:"contracts", label:"계약 관리", icon:"doc", countKey:"contractTargets"},
    {key:"subsidy", label:"지원금 관리", icon:"coin", countKey:"subsidyTargets"},
    {key:"leave", label:"휴가자 관리", icon:"people", countKey:"leaveTargets"},
  ]},
  { label:"설정", items:[
    {key:"employees", label:"인력 마스터", icon:"people", countKey:"employees"},
    {key:"subsidyPrograms", label:"지원금 마스터", icon:"coin", countKey:"subsidyPrograms"},
    {key:"systemSettings", label:"시스템 설정", icon:"lock"},
  ]},
];
export const PMO_RESTRICTED_ROUTES = ["employees", "subsidyPrograms", "systemSettings", "subsidy"];
export const PMO_MENU_SUFFIX_ROUTES = ["dashboard", "probation", "contracts", "leave"];
