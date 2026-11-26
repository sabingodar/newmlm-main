export function loginIdentity(value) {
 const identifier=String(value??'').trim().slice(0,100);
 const digits=identifier.replace(/\D/g,'');
 const phone=/^[+\d\s().-]+$/.test(identifier)&&digits.length>=7
  ?digits.replace(/^(?:00977|977)(?=\d{10}$)/,''):'';
 return {identifier,phone};
}
